// publico/js/modulos/tema.js · Vista del tema formativo para el estudiante
import { montarPlantilla } from '../nucleo/plantilla.js';
import { obtener, listar, crear } from '../nucleo/api.js';
import { aviso, escapar, cargando } from '../nucleo/ui.js';
import { parametro, formatoBasico } from '../nucleo/util.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: "Tema", roles: ["estudiante", "docente", "admin"] });

const temaId = parametro('id');
const contenido = document.getElementById('contenido');
const usuario = usuarioActual();

function obtenerEmbedVideoUrl(url) {
  if (!url) return null;
  // YouTube
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }
  // Vimeo
  const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }
  return null;
}

if (!temaId) {
  if (contenido) {
    contenido.innerHTML = `
      <div class="tarjeta vacio">
        <div class="vacio__icono">⚠️</div>
        <h2 class="vacio__titulo">Tema no especificado</h2>
        <p class="vacio__texto">Selecciona un tema desde la lista de asignaturas.</p>
        <a href="/paginas/asignaturas.html" class="btn btn--primario" style="margin-top: var(--espacio-m);">Ir a Mis Asignaturas</a>
      </div>
    `;
  }
} else {
  async function cargarTema() {
    cargando(true);
    try {
      const tema = await obtener('temas', temaId);
      if (!tema) throw new Error('Tema no encontrado');

      // Guardar en localStorage
      try {
        localStorage.setItem('ultimoTema', JSON.stringify({
          id: tema.id,
          titulo: tema.titulo
        }));
      } catch (e) {
        console.warn('No se pudo guardar en localStorage:', e);
      }

      // Obtener unidad y asignatura para migas de pan
      let unidad = null;
      let asignatura = null;
      if (tema.unidadId) {
        unidad = await obtener('unidades', tema.unidadId);
        if (unidad && unidad.asignaturaId) {
          asignatura = await obtener('asignaturas', unidad.asignaturaId);
        }
      }

      // Verificar si ya está revisado
      const [progreso, glosarioRespuesta] = await Promise.all([
        listar('progreso-temas', { temaId: tema.id }),
        listar('glosario', { temaId: tema.id })
      ]);
      const estaRevisado = Array.isArray(progreso) && progreso.length > 0;
      const glosario = Array.isArray(glosarioRespuesta)
        ? glosarioRespuesta.filter(item => item.estado === 'aprobado')
        : [];

      renderizar(tema, unidad, asignatura, estaRevisado, glosario);
    } catch (err) {
      aviso(err.message || 'Error al cargar el tema', 'error');
      if (contenido) {
        contenido.innerHTML = `<p style="color: var(--error);">No se pudo cargar el contenido del tema.</p>`;
      }
    } finally {
      cargando(false);
    }
  }

  function renderizar(tema, unidad, asignatura, estaRevisado, glosario) {
    if (!contenido) return;

    // 1. Migas de pan
    const migasHtml = `
      <nav class="tema-migas" aria-label="Ruta de navegación">
        <a href="/paginas/asignaturas.html">Mis Asignaturas</a>
        <span>/</span>
        ${asignatura ? `<a href="/paginas/asignatura.html?id=${encodeURIComponent(asignatura.id)}">${escapar(asignatura.nombre)}</a><span>/</span>` : ''}
        ${unidad ? `<span>${escapar(unidad.titulo)}</span><span>/</span>` : ''}
        <span style="color: var(--primario); font-weight: var(--peso-seminegrita);">${escapar(tema.titulo)}</span>
      </nav>
    `;

    // 2. Objetivos
    let objetivosHtml = '';
    if (Array.isArray(tema.objetivos) && tema.objetivos.length > 0) {
      objetivosHtml = `
        <section class="tarjeta" aria-labelledby="sec-objetivos">
          <h2 id="sec-objetivos" class="tarjeta__titulo" style="font-size: var(--tamano-m); margin-bottom: var(--espacio-s);">
            🎯 Objetivos de Aprendizaje
          </h2>
          <ul style="padding-left: var(--espacio-l); margin: 0; line-height: var(--interlineado-base);">
            ${tema.objetivos.map(obj => `<li>${escapar(obj)}</li>`).join('')}
          </ul>
        </section>
      `;
    }

    // 3. Resumen formativo
    const resumenFormateado = formatoBasico(tema.resumen || '');
    const resumenHtml = `
      <section class="tarjeta" aria-labelledby="sec-resumen">
        <h2 id="sec-resumen" class="tarjeta__titulo" style="font-size: var(--tamano-m); margin-bottom: var(--espacio-s);">
          📖 Resumen del Contenido
        </h2>
        <div class="tema-resumen-cuerpo">
          ${resumenFormateado || '<p style="color: var(--texto-suave);">Sin contenido de resumen disponible.</p>'}
        </div>
      </section>
    `;

    // 4. Ejemplos
    let ejemplosHtml = '';
    if (Array.isArray(tema.ejemplos) && tema.ejemplos.length > 0) {
      ejemplosHtml = `
        <section class="tarjeta" aria-labelledby="sec-ejemplos">
          <h2 id="sec-ejemplos" class="tarjeta__titulo" style="font-size: var(--tamano-m); margin-bottom: var(--espacio-s);">
            💡 Ejemplos Prácticos
          </h2>
          <ul style="padding-left: var(--espacio-l); margin: 0; line-height: var(--interlineado-base);">
            ${tema.ejemplos.map(ej => `<li>${escapar(ej)}</li>`).join('')}
          </ul>
        </section>
      `;
    }

    // 5. Recursos
    let recursosHtml = '';
    if (Array.isArray(tema.recursos) && tema.recursos.length > 0) {
      recursosHtml = `
        <section class="tarjeta" aria-labelledby="sec-recursos">
          <h2 id="sec-recursos" class="tarjeta__titulo" style="font-size: var(--tamano-m); margin-bottom: var(--espacio-s);">
            📁 Recursos Complementarios
          </h2>
          <div class="tema-recursos-grid">
            ${tema.recursos.map(rec => {
              const embed = rec.tipo === 'video' ? obtenerEmbedVideoUrl(rec.url) : null;

              if (embed) {
                return `
                  <div class="tarjeta-recurso" style="grid-column: 1 / -1;">
                    <strong>🎬 ${escapar(rec.titulo)}</strong>
                    <div class="recurso-video-embed">
                      <iframe src="${escapar(embed)}" title="${escapar(rec.titulo)}" allowfullscreen loading="lazy"></iframe>
                    </div>
                  </div>
                `;
              }

              if (rec.tipo === 'imagen') {
                return `
                  <div class="tarjeta-recurso">
                    <strong>🖼️ ${escapar(rec.titulo)}</strong>
                    <img src="${escapar(rec.url)}" alt="${escapar(rec.titulo)}" class="recurso-imagen" loading="lazy">
                  </div>
                `;
              }

              if (rec.tipo === 'pdf') {
                return `
                  <div class="tarjeta-recurso">
                    <strong>📄 Documento PDF</strong>
                    <p style="font-size: var(--tamano-s);">${escapar(rec.titulo)}</p>
                    <a href="${escapar(rec.url)}" target="_blank" rel="noopener" class="btn btn--secundario btn--pequeno" style="margin-top: auto;">
                      Abrir PDF ↗
                    </a>
                  </div>
                `;
              }

              return `
                <div class="tarjeta-recurso">
                  <strong>🔗 Enlace externo</strong>
                  <p style="font-size: var(--tamano-s);">${escapar(rec.titulo)}</p>
                  <a href="${escapar(rec.url)}" target="_blank" rel="noopener" class="btn btn--secundario btn--pequeno" style="margin-top: auto;">
                    Visitar enlace ↗
                  </a>
                </div>
              `;
            }).join('')}
          </div>
        </section>
      `;
    }

    // 6. Glosario aprobado
    const glosarioHtml = glosario.length > 0 ? `
      <section class="tarjeta" aria-labelledby="sec-glosario">
        <h2 id="sec-glosario" class="tarjeta__titulo tema-seccion-titulo">Glosario del tema</h2>
        <dl class="tema-glosario">
          ${glosario.map(item => `
            <div class="tema-glosario__termino">
              <dt>
                ${escapar(item.termino)}
                ${item.origen === 'ia' ? '<span class="insignia insignia--acento">Generado con IA</span>' : ''}
              </dt>
              <dd>${escapar(item.definicion)}</dd>
              ${item.retroalimentacion ? `<dd class="tema-glosario__retro">${escapar(item.retroalimentacion)}</dd>` : ''}
            </div>
          `).join('')}
        </dl>
      </section>
    ` : '';

    // 7. Actividades prácticas
    let actividadesHtml = '';
    if (Array.isArray(ACTIVIDADES) && ACTIVIDADES.length > 0) {
      actividadesHtml = `
        <div class="actividades-grid">
          ${ACTIVIDADES.filter(act => act.id !== 'tutor' || usuario?.rol === 'estudiante').map(act => `
            <a href="${escapar(act.href)}?temaId=${encodeURIComponent(tema.id)}" class="actividad-card">
              <div>
                <strong style="color: var(--primario); font-size: var(--tamano-m);">${escapar(act.texto)}</strong>
                <p style="font-size: var(--tamano-xs); color: var(--texto-suave); margin-top: var(--espacio-xs);">
                  ${escapar(act.descripcion || '')}
                </p>
              </div>
              <span class="btn btn--texto btn--pequeno" style="align-self: flex-start; padding-left: 0; margin-top: var(--espacio-s);">
                Comenzar actividad →
              </span>
            </a>
          `).join('')}
        </div>
      `;
    } else {
      actividadesHtml = `
        <div class="vacio" style="padding: var(--espacio-l); background-color: var(--fondo); border-radius: var(--radio-m); margin-top: var(--espacio-s);">
          <p class="vacio__texto" style="font-size: var(--tamano-s);">
            Próximamente se integrarán juegos didácticos y actividades evaluativas para este tema.
          </p>
        </div>
      `;
    }

    const practicaHtml = `
      <section class="tarjeta" aria-labelledby="sec-practica">
        <h2 id="sec-practica" class="tarjeta__titulo" style="font-size: var(--tamano-m); margin-bottom: 0;">
          🎮 Practica este tema
        </h2>
        ${actividadesHtml}
      </section>
    `;

    // Botón de marcar como revisado
    const botonRevisadoHtml = estaRevisado
      ? `<button type="button" class="btn btn--exito" id="btn-revisado" disabled>Revisado ✓</button>`
      : `<button type="button" class="btn btn--primario" id="btn-marcar-revisado">Marcar como revisado</button>`;

    contenido.innerHTML = `
      <div class="tema-vista-layout">
        <div class="tarjeta">
          ${migasHtml}
          <div class="fila fila--m" style="justify-content: space-between; align-items: center; margin-top: var(--espacio-m); flex-wrap: wrap; gap: var(--espacio-m);">
            <h1 class="tarjeta__titulo" style="margin: 0; font-size: var(--tamano-xl);">${escapar(tema.titulo)}</h1>
            <div class="fila fila--s" style="flex-wrap: wrap;">
              ${usuario?.rol === 'estudiante' ? `
                <a href="/paginas/tutor.html?temaId=${encodeURIComponent(tema.id)}" class="btn btn--secundario tema-tutor">
                  <img src="/recursos/tutor-socratico.png" alt="" class="tema-tutor__avatar">
                  <span class="tema-tutor__texto">
                    <span>¿Tienes preguntas?</span>
                    <strong>Aquí está tu tutor socrático</strong>
                    <span>Mi nombre es Canelo</span>
                  </span>
                </a>
              ` : ''}
              <div id="contenedor-btn-revisado">
                ${botonRevisadoHtml}
              </div>
            </div>
          </div>
        </div>

        ${objetivosHtml}
        ${resumenHtml}
        ${ejemplosHtml}
        ${recursosHtml}
        ${glosarioHtml}
        ${practicaHtml}
      </div>
    `;

    if (window.location.hash === '#sec-glosario') {
      requestAnimationFrame(() => {
        document.getElementById('sec-glosario')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    const btnMarcar = document.getElementById('btn-marcar-revisado');
    if (btnMarcar) {
      btnMarcar.addEventListener('click', async () => {
        btnMarcar.disabled = true;
        btnMarcar.textContent = 'Guardando...';
        try {
          await crear('progreso-temas', { temaId: tema.id });
          try {
            await registrarIntento({ actividad: 'tema-revisado', temaId: tema.id, puntaje: 1, maximo: 1 });
          } catch (errIntento) {
            console.warn('Error al registrar intento de gamificación:', errIntento);
          }
          aviso('¡Tema registrado como revisado!', 'exito');
          const contBtn = document.getElementById('contenedor-btn-revisado');
          if (contBtn) {
            contBtn.innerHTML = `<button type="button" class="btn btn--exito" disabled>Revisado ✓</button>`;
          }
        } catch (err) {
          aviso(err.message || 'Error al registrar progreso', 'error');
          btnMarcar.disabled = false;
          btnMarcar.textContent = 'Marcar como revisado';
        }
      });
    }
  }

  await cargarTema();
}
