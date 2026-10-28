// publico/js/modulos/simulaciones.js · Catálogo y selección de simulaciones por tema
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Simulaciones", roles: ["sesion"] });

const contenido = document.getElementById('contenido');
const usuario = usuarioActual();
const esDocenteOAdmin = usuario && ['docente', 'admin'].includes(usuario.rol);

async function cargarSimulaciones() {
  if (!contenido) return;

  contenido.innerHTML = `
    <div class="cargando" role="status" aria-live="polite">
      <p style="color: var(--texto-suave);">Cargando simulaciones...</p>
    </div>
  `;

  try {
    const [simulaciones, temas, asignaturas, unidades] = await Promise.all([
      api.listar('simulaciones').catch(() => []),
      api.listar('temas').catch(() => []),
      api.listar('asignaturas').catch(() => []),
      api.listar('unidades').catch(() => [])
    ]);

    const mapaAsignaturas = new Map((asignaturas || []).map(a => [a.id, a.nombre]));
    const mapaUnidadAsignatura = new Map((unidades || []).map(u => [u.id, u.asignaturaId]));
    const mapaTemas = new Map((temas || []).map(t => {
      const asigId = mapaUnidadAsignatura.get(t.unidadId);
      return [t.id, {
        titulo: t.titulo,
        asignatura: asigId ? (mapaAsignaturas.get(asigId) || '') : ''
      }];
    }));

    renderizarInterfaz(simulaciones || [], mapaTemas);
  } catch (err) {
    console.error('Error al cargar simulaciones:', err);
    contenido.innerHTML = `
      <div class="alerta alerta--error" role="alert">
        <p>No se pudieron cargar las simulaciones disponibles. Inténtalo más tarde.</p>
      </div>
    `;
  }
}

function renderizarInterfaz(simulaciones, mapaTemas) {
  // Agrupar simulaciones por tema
  const gruposPorTema = new Map();
  for (const sim of simulaciones) {
    const temaId = sim.temaId || 'sin-tema';
    if (!gruposPorTema.has(temaId)) {
      gruposPorTema.set(temaId, []);
    }
    gruposPorTema.get(temaId).push(sim);
  }

  let htmlSecciones = '';

  if (simulaciones.length === 0) {
    htmlSecciones = `
      <section class="vacio tarjeta" aria-label="Sin simulaciones">
        <div class="vacio__icono" aria-hidden="true" style="font-size: 3rem; text-align: center; margin-bottom: var(--espacio-s);">🎭</div>
        <h2 class="vacio__titulo" style="text-align: center; color: var(--primario);">No hay simulaciones disponibles</h2>
        <p class="vacio__texto" style="text-align: center; color: var(--texto-suave);">
          ${esDocenteOAdmin
            ? 'Aún no se han creado simulaciones en tus asignaturas. Haz clic en "Nueva simulación" para crear una.'
            : 'Pronto tu docente publicará escenarios prácticos y casos de simulación.'}
        </p>
      </section>
    `;
  } else {
    for (const [temaId, lista] of gruposPorTema.entries()) {
      const infoTema = mapaTemas.get(temaId) || { titulo: 'Casos y escenarios generales', asignatura: '' };
      const tarjetasHtml = lista.map(sim => {
        const modoTexto = Array.isArray(sim.banco) && sim.banco.length > 0
          ? `Banco de ${sim.banco.length} dilemas (4 al azar)`
          : (sim.modo === 'rol' ? 'Rol interactivo' : 'Escenarios ramificados');
        const modoClase = sim.modo === 'rol' ? 'chip chip--morado' : 'chip chip--azul';
        const estadoHtml = esDocenteOAdmin
          ? `<span class="chip ${sim.estado === 'publicado' ? 'chip--verde' : 'chip--gris'}">${sim.estado === 'publicado' ? 'Publicado' : 'Borrador'}</span>`
          : '';

        return `
          <article class="simulacion-tarjeta">
            <div>
              <div class="simulacion-tarjeta__cabecera">
                <h3 class="simulacion-tarjeta__titulo">${escapar(sim.titulo || 'Simulación sin título')}</h3>
              </div>
              <div class="simulacion-tarjeta__metas">
                <span class="${modoClase}">${modoTexto}</span>
                ${estadoHtml}
              </div>
            </div>
            <div class="simulacion-tarjeta__acciones">
              ${esDocenteOAdmin ? `
                <a href="/paginas/editor-simulacion.html?id=${encodeURIComponent(sim.id)}" class="btn btn--secundario btn--pequeno">
                  Editar
                </a>
              ` : ''}
              <a href="/paginas/simulador.html?id=${encodeURIComponent(sim.id)}&vista=previa" class="btn btn--secundario btn--pequeno">
                Vista previa
              </a>
              <a href="/paginas/simulador.html?id=${encodeURIComponent(sim.id)}" class="btn btn--primario btn--pequeno">
                Iniciar
              </a>
            </div>
          </article>
        `;
      }).join('');

      htmlSecciones += `
        <section class="simulaciones-tema-seccion" aria-labelledby="tema-encabezado-${escapar(temaId)}">
          <div class="simulaciones-tema-seccion__cabecera">
            <h2 id="tema-encabezado-${escapar(temaId)}" class="simulaciones-tema-seccion__titulo">
              ${escapar(infoTema.titulo)}
            </h2>
            ${infoTema.asignatura ? `<span class="simulaciones-tema-seccion__asignatura">${escapar(infoTema.asignatura)}</span>` : ''}
          </div>
          <div class="simulaciones-grid" role="list">
            ${tarjetasHtml}
          </div>
        </section>
      `;
    }
  }

  contenido.innerHTML = `
    <header class="simulaciones-cabecera">
      <div class="simulaciones-cabecera__info">
        <h1 class="simulaciones-cabecera__titulo">Simulaciones Prácticas</h1>
        <p class="simulaciones-cabecera__descripcion">
          Pon a prueba tu criterio tomando decisiones en situaciones reales y casos clínicos.
        </p>
      </div>
      ${esDocenteOAdmin ? `
        <div class="simulaciones-cabecera__acciones">
          <a href="/paginas/editor-simulacion.html" class="btn btn--primario">
            + Nueva simulación
          </a>
        </div>
      ` : ''}
    </header>

    ${htmlSecciones}
  `;
}

cargarSimulaciones();
