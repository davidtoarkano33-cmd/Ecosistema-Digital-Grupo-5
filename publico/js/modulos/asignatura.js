// publico/js/modulos/asignatura.js · Vista de unidades y temas de una asignatura
import { montarPlantilla } from '../nucleo/plantilla.js';
import { obtener, listar } from '../nucleo/api.js';
import { aviso, escapar, cargando } from '../nucleo/ui.js';
import { parametro } from '../nucleo/util.js';

await montarPlantilla({ titulo: "Asignatura", roles: ["estudiante", "docente", "admin"] });

const asignaturaId = parametro('id');
const contenido = document.getElementById('contenido');

if (!asignaturaId) {
  if (contenido) {
    contenido.innerHTML = `
      <div class="tarjeta vacio">
        <div class="vacio__icono">⚠️</div>
        <h2 class="vacio__titulo">Falta la asignatura</h2>
        <p class="vacio__texto">Por favor selecciona una asignatura desde la vista principal.</p>
        <a href="/paginas/asignaturas.html" class="btn btn--primario" style="margin-top: var(--espacio-m);">Ver Mis Asignaturas</a>
      </div>
    `;
  }
} else {
  async function cargarAsignatura() {
    cargando(true);
    try {
      const [asig, unidades, temas, progreso] = await Promise.all([
        obtener('asignaturas', asignaturaId),
        listar('unidades', { asignaturaId }),
        listar('temas'),
        listar('progreso-temas')
      ]);

      const unidadesVisibles = (Array.isArray(unidades) ? unidades : [])
        .filter(u => u.visible !== false)
        .sort((a, b) => (a.orden || 0) - (b.orden || 0));

      const temasPublicados = (Array.isArray(temas) ? temas : [])
        .filter(t => t.estado === 'publicado')
        .sort((a, b) => (a.orden || 0) - (b.orden || 0));

      const temasRevisadosIds = new Set(
        (Array.isArray(progreso) ? progreso : []).map(p => p.temaId)
      );

      renderizar(asig, unidadesVisibles, temasPublicados, temasRevisadosIds);
    } catch (err) {
      aviso(err.message || 'Error al cargar los contenidos de la asignatura', 'error');
      if (contenido) {
        contenido.innerHTML = `<p style="color: var(--error);">No se pudo cargar la información de la asignatura.</p>`;
      }
    } finally {
      cargando(false);
    }
  }

  function renderizar(asig, unidades, temas, temasRevisadosIds) {
    if (!contenido) return;

    let bloquesUnidadesHtml = '';
    if (unidades.length === 0) {
      bloquesUnidadesHtml = `
        <div class="vacio" style="padding: var(--espacio-xl);">
          <div class="vacio__icono">📖</div>
          <h3 class="vacio__titulo">No hay unidades disponibles</h3>
          <p class="vacio__texto">El docente aún no ha publicado unidades didácticas para esta materia.</p>
        </div>
      `;
    } else {
      bloquesUnidadesHtml = unidades.map(u => {
        const temasDeEstaUnidad = temas.filter(t => t.unidadId === u.id);

        let filasTemasHtml = '';
        if (temasDeEstaUnidad.length === 0) {
          filasTemasHtml = `
            <div style="padding: var(--espacio-m) var(--espacio-l); color: var(--texto-suave); font-size: var(--tamano-s);">
              No hay temas publicados en esta unidad.
            </div>
          `;
        } else {
          filasTemasHtml = temasDeEstaUnidad.map(t => {
            const revisado = temasRevisadosIds.has(t.id);
            return `
              <div class="asignatura-tema-fila">
                <div class="asignatura-tema-info">
                  <span class="tema-numero-badge">${t.orden || 1}</span>
                  <div>
                    <strong style="font-size: var(--tamano-s); color: var(--texto);">${escapar(t.titulo)}</strong>
                    <div style="margin-top: 2px;">
                      <span class="insignia insignia--xs ${revisado ? 'insignia--exito' : 'insignia--secundario'}">
                        ${revisado ? 'Revisado ✓' : 'Pendiente'}
                      </span>
                      <span class="insignia insignia--xs insignia--info" style="margin-left: 4px;">
                        ${escapar(t.dificultad || 'intermedio')}
                      </span>
                    </div>
                  </div>
                </div>

                <div class="asignatura-tema-acciones">
                  <a href="/paginas/tema.html?id=${encodeURIComponent(t.id)}" class="btn btn--primario btn--pequeno">
                    ${revisado ? 'Repasar Tema' : 'Estudiar Tema →'}
                  </a>
                  <a href="/paginas/tema.html?id=${encodeURIComponent(t.id)}#sec-glosario" class="btn btn--secundario btn--pequeno">
                    Glosario
                  </a>
                </div>
              </div>
            `;
          }).join('');
        }

        return `
          <section class="asignatura-unidad-bloque" aria-labelledby="unidad-titulo-${escapar(u.id)}">
            <div class="asignatura-unidad-cabecera">
              <h2 id="unidad-titulo-${escapar(u.id)}" style="font-size: var(--tamano-m); margin: 0; color: var(--primario);">
                Unidad ${u.orden || 1}: ${escapar(u.titulo)}
              </h2>
              <span class="insignia insignia--info" style="font-size: var(--tamano-xs);">
                ${temasDeEstaUnidad.length} temas
              </span>
            </div>
            <div class="asignatura-temas-lista">
              ${filasTemasHtml}
            </div>
          </section>
        `;
      }).join('');
    }

    // Construcción del árbol del Índice del Curso para el panel deslizable
    const indiceUnidadesHtml = unidades.map((u, uIdx) => {
      const temasDeEstaUnidad = temas.filter(t => t.unidadId === u.id);
      const temasLinksHtml = temasDeEstaUnidad.map(t => {
        const revisado = temasRevisadosIds.has(t.id);
        return `
          <li class="indice-curso__item-tema">
            <a href="#tema-fila-${escapar(t.id)}" class="indice-curso__enlace-tema" data-tema-id="${escapar(t.id)}">
              <span class="indice-curso__icono-estado ${revisado ? 'indice-curso__icono-estado--revisado' : ''}">
                ${revisado ? '✓' : '•'}
              </span>
              <span class="indice-curso__tema-texto">${escapar(t.titulo)}</span>
            </a>
            <a href="/paginas/tema.html?id=${encodeURIComponent(t.id)}#sec-glosario" class="indice-curso__enlace-glosario">
              Ver glosario
            </a>
          </li>
        `;
      }).join('');

      return `
        <div class="indice-curso__unidad-acordeon" data-unidad-id="${escapar(u.id)}">
          <button type="button" class="indice-curso__unidad-boton" aria-expanded="true">
            <span class="indice-curso__flecha">▼</span>
            <span class="indice-curso__unidad-nombre">Unidad ${u.orden || uIdx + 1}: ${escapar(u.titulo)}</span>
          </button>
          <ul class="indice-curso__temas-sublista">
            ${temasLinksHtml || '<li class="indice-curso__sin-temas">Sin temas</li>'}
          </ul>
        </div>
      `;
    }).join('');

    contenido.innerHTML = `
      <div class="asignatura-layout-con-indice">
        <!-- Botón flotante accesible para abrir índice del curso -->
        <button type="button" id="btn-abrir-indice" class="btn-flotante-indice" aria-label="Abrir Índice del curso" title="Abrir Índice del curso">
          <span class="btn-flotante-indice__icono" aria-hidden="true">☰</span>
          <span class="btn-flotante-indice__texto">Índice del curso</span>
        </button>

        <!-- Panel lateral deslizable (Offcanvas Drawer) -->
        <div id="indice-backdrop" class="indice-backdrop" aria-hidden="true"></div>
        <aside id="panel-indice-curso" class="panel-indice-curso" role="dialog" aria-modal="true" aria-label="Índice del curso">
          <div class="panel-indice-curso__cabecera">
            <div class="panel-indice-curso__titulo-bloque">
              <span class="panel-indice-curso__badge-materia">Curso</span>
              <h3 class="panel-indice-curso__titulo">Índice del curso</h3>
            </div>
            <button type="button" id="btn-cerrar-indice" class="btn-cerrar-indice" aria-label="Cerrar el índice del curso" title="Cerrar">
              ✕
            </button>
          </div>

          <div class="panel-indice-curso__cuerpo">
            <div class="panel-indice-curso__info-materia">
              <strong style="color: var(--primario); font-size: var(--tamano-s);">${escapar(asig.nombre)}</strong>
              <span style="font-size: var(--tamano-xs); color: var(--texto-suave);">${escapar(asig.nivel || 'Nivel Superior')}</span>
            </div>
            <nav class="indice-curso__arbol" aria-label="Navegación del índice">
              ${indiceUnidadesHtml}
            </nav>
          </div>
        </aside>

        <!-- Contenido principal -->
        <div class="asignatura-detalle-layout">
          <header class="tarjeta asignatura-cabecera-principal">
            <div class="fila fila--xs" style="margin-bottom: var(--espacio-xs); justify-content: space-between;">
              <a href="/paginas/asignaturas.html" class="btn btn--texto btn--pequeno">← Volver a Mis Asignaturas</a>
              <span class="insignia insignia--info">${escapar(asig.nivel || 'Nivel Superior')}</span>
            </div>
            <div class="asignatura-cabecera__fila-titulo">
              <div>
                <h1 class="tarjeta__titulo" style="margin: 0; color: var(--primario);">${escapar(asig.nombre)}</h1>
                <p class="tarjeta__subtitulo" style="margin-top: var(--espacio-xs);">${escapar(asig.descripcion || '')}</p>
              </div>
              <button type="button" id="btn-abrir-indice-cabecera" class="btn btn--secundario btn--pequeno btn-accion-indice-top">
                📑 Ver índice del curso
              </button>
            </div>
          </header>

          <main class="asignatura-unidades-contenedor">
            ${bloquesUnidadesHtml}
          </main>
        </div>
      </div>
    `;

    // Asignar IDs a las filas de temas para scroll suave
    temas.forEach(t => {
      const filaTemaEl = contenido.querySelectorAll('.asignatura-tema-fila');
      filaTemaEl.forEach(f => {
        const link = f.querySelector(`a[href*="id=${t.id}"]`);
        if (link) {
          f.id = `tema-fila-${t.id}`;
        }
      });
    });

    // Control de apertura y cierre del panel deslizable
    const panelIndice = document.getElementById('panel-indice-curso');
    const backdrop = document.getElementById('indice-backdrop');
    const btnAbrir = document.getElementById('btn-abrir-indice');
    const btnAbrirTop = document.getElementById('btn-abrir-indice-cabecera');
    const btnCerrar = document.getElementById('btn-cerrar-indice');

    function alternarIndice(abrir) {
      const debeAbrir = abrir !== undefined ? abrir : !panelIndice.classList.contains('panel-indice-curso--abierto');
      if (debeAbrir) {
        panelIndice.classList.add('panel-indice-curso--abierto');
        backdrop.classList.add('indice-backdrop--activo');
        document.body.style.overflow = 'hidden';
        btnCerrar.focus();
      } else {
        panelIndice.classList.remove('panel-indice-curso--abierto');
        backdrop.classList.remove('indice-backdrop--activo');
        document.body.style.overflow = '';
      }
    }

    if (btnAbrir) btnAbrir.addEventListener('click', () => alternarIndice(true));
    if (btnAbrirTop) btnAbrirTop.addEventListener('click', () => alternarIndice(true));
    if (btnCerrar) btnCerrar.addEventListener('click', () => alternarIndice(false));
    if (backdrop) backdrop.addEventListener('click', () => alternarIndice(false));

    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panelIndice && panelIndice.classList.contains('panel-indice-curso--abierto')) {
        alternarIndice(false);
      }
    });

    // Acordeón de unidades dentro del índice
    const botonesUnidad = contenido.querySelectorAll('.indice-curso__unidad-boton');
    botonesUnidad.forEach(btnU => {
      btnU.addEventListener('click', () => {
        const bloquePadre = btnU.closest('.indice-curso__unidad-acordeon');
        const flecha = btnU.querySelector('.indice-curso__flecha');
        const sublista = bloquePadre.querySelector('.indice-curso__temas-sublista');
        const colapsado = sublista.style.display === 'none';

        if (colapsado) {
          sublista.style.display = 'block';
          flecha.textContent = '▼';
          btnU.setAttribute('aria-expanded', 'true');
        } else {
          sublista.style.display = 'none';
          flecha.textContent = '▶';
          btnU.setAttribute('aria-expanded', 'false');
        }
      });
    });

    // Desplazamiento suave al hacer clic en un tema del índice
    const enlacesTemas = contenido.querySelectorAll('.indice-curso__enlace-tema');
    enlacesTemas.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const temaId = link.getAttribute('data-tema-id');
        const destino = document.getElementById(`tema-fila-${temaId}`);

        // Marcar enlace activo
        enlacesTemas.forEach(l => l.classList.remove('indice-curso__enlace-tema--activo'));
        link.classList.add('indice-curso__enlace-tema--activo');

        alternarIndice(false);

        if (destino) {
          destino.scrollIntoView({ behavior: 'smooth', block: 'center' });
          destino.classList.add('asignatura-tema-fila--resaltado');
          setTimeout(() => {
            destino.classList.remove('asignatura-tema-fila--resaltado');
          }, 2000);
        }
      });
    });
  }

  await cargarAsignatura();
}
