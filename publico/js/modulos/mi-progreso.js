// publico/js/modulos/mi-progreso.js · Panel de progreso del estudiante con métricas y gráficos
import { montarPlantilla } from '../nucleo/plantilla.js';
import { llamar } from '../nucleo/api.js';
import { escapar, cargando, aviso } from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Mi Progreso", roles: ["estudiante"] });

const contenido = document.getElementById('contenido');

// Colores institucionales de tokens.css
const COLOR_PRIMARIO = '#002e45';
const COLOR_ACENTO = '#ff6900';
const COLOR_INFO = '#1470a8';
const COLOR_BORDE = '#dfe7ec';
const COLOR_TEXTO_SUAVE = '#627586';

function montarGraficoEvolucion(ctx, evolucion) {
  if (!evolucion || evolucion.length === 0) {
    ctx.parentElement.innerHTML = `
      <div class="vacio" style="height: 100%; border: none; padding: var(--espacio-l);">
        <span class="vacio__icono">📈</span>
        <h4 class="vacio__titulo">Sin datos de evolución</h4>
        <p class="vacio__texto">Completa actividades formativas para visualizar tu progreso semanal.</p>
      </div>
    `;
    return;
  }

  const etiquetas = evolucion.map(e => e.semana);
  const valores = evolucion.map(e => (typeof e.promedio === 'number' ? e.promedio : null));

  /* global Chart */
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: etiquetas,
      datasets: [{
        label: 'Promedio semanal (/10)',
        data: valores,
        borderColor: COLOR_ACENTO,
        backgroundColor: 'rgba(255, 105, 0, 0.1)',
        borderWidth: 3,
        pointBackgroundColor: COLOR_PRIMARIO,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context) => `Promedio: ${context.parsed.y} / 10`
          }
        }
      },
      scales: {
        y: {
          min: 0,
          max: 10,
          ticks: {
            stepSize: 2,
            color: COLOR_TEXTO_SUAVE,
            font: { family: 'Poppins, Arial, sans-serif' }
          },
          grid: {
            color: COLOR_BORDE
          }
        },
        x: {
          ticks: {
            color: COLOR_TEXTO_SUAVE,
            font: { family: 'Poppins, Arial, sans-serif' }
          },
          grid: {
            display: false
          }
        }
      }
    }
  });
}

function formatearNombreActividad(id) {
  const mapa = {
    'ahorcado': 'Ahorcado',
    'pareja': 'Parejas',
    'sopa-letras': 'Sopa de letras',
    'quiz': 'Quiz evaluativo',
    'cancion': 'Canciones',
    'foro': 'Participación en foros'
  };
  return mapa[id] || (id ? id.charAt(0).toUpperCase() + id.slice(1) : 'General');
}

function montarGraficoActividades(ctx, porActividad) {
  if (!porActividad || porActividad.length === 0) {
    ctx.parentElement.innerHTML = `
      <div class="vacio" style="height: 100%; border: none; padding: var(--espacio-l);">
        <span class="vacio__icono">📊</span>
        <h4 class="vacio__titulo">Sin actividades evaluadas</h4>
        <p class="vacio__texto">Participa en juegos y desafíos interactivos para ver tu rendimiento por tipo.</p>
      </div>
    `;
    return;
  }

  const etiquetas = porActividad.map(a => formatearNombreActividad(a.actividad));
  const valores = porActividad.map(a => (typeof a.promedio === 'number' ? a.promedio : 0));

  /* global Chart */
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: etiquetas,
      datasets: [{
        label: 'Promedio (/10)',
        data: valores,
        backgroundColor: [
          COLOR_PRIMARIO,
          COLOR_ACENTO,
          COLOR_INFO,
          '#1b7a43',
          '#7e22ce',
          '#b55300'
        ],
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context) => `Promedio: ${context.parsed.y} / 10`
          }
        }
      },
      scales: {
        y: {
          min: 0,
          max: 10,
          ticks: {
            stepSize: 2,
            color: COLOR_TEXTO_SUAVE,
            font: { family: 'Poppins, Arial, sans-serif' }
          },
          grid: {
            color: COLOR_BORDE
          }
        },
        x: {
          ticks: {
            color: COLOR_TEXTO_SUAVE,
            font: { family: 'Poppins, Arial, sans-serif' }
          },
          grid: {
            display: false
          }
        }
      }
    }
  });
}

if (contenido) {
  cargando(true);
  try {
    const resumen = await llamar('GET', '/api/resumen/estudiante/yo');

    const puntos = typeof resumen.puntos === 'number' ? resumen.puntos : 0;
    const nivelQuiz = typeof resumen.nivelQuizMax === 'number' ? resumen.nivelQuizMax : 0;
    const pctTemas = typeof resumen.pctTemas === 'number' ? resumen.pctTemas : 0;
    const promedio = typeof resumen.promedio === 'number' ? resumen.promedio : null;
    const promedioTexto = promedio !== null ? promedio.toFixed(1) : '—';

    const pendientes = Array.isArray(resumen.pendientes) ? resumen.pendientes : [];

    let listaPendientesHtml = '';
    if (pendientes.length === 0) {
      listaPendientesHtml = `
        <div class="vacio" style="grid-column: 1 / -1;">
          <span class="vacio__icono">🎉</span>
          <h4 class="vacio__titulo">¡Estás al día!</h4>
          <p class="vacio__texto">Has revisado todos los temas publicados de tus asignaturas asignadas.</p>
        </div>
      `;
    } else {
      listaPendientesHtml = pendientes.map(p => `
        <a href="/paginas/tema.html?id=${escapar(p.temaId)}" class="pendiente-item" title="Ir a ${escapar(p.titulo)}">
          <div class="pendiente-item__info">
            <span class="pendiente-item__icono" aria-hidden="true">📖</span>
            <span class="pendiente-item__titulo">${escapar(p.titulo)}</span>
          </div>
          <span class="pendiente-item__accion">Revisar →</span>
        </a>
      `).join('');
    }

    contenido.innerHTML = `
      <div class="progreso-contenedor">
        <!-- Cabecera -->
        <header class="progreso-cabecera">
          <div>
            <h1 class="progreso-cabecera__titulo">Mi Progreso Académico</h1>
            <p class="progreso-cabecera__subtitulo">Métricas de desempeño, actividades evaluadas y temas por revisar</p>
          </div>
        </header>

        <!-- 1. Tarjetas métricas -->
        <section class="progreso-metricas-grid" aria-label="Métricas principales de aprendizaje">
          <div class="tarjeta-metrica">
            <div class="tarjeta-metrica__icono tarjeta-metrica__icono--puntos" aria-hidden="true">⭐</div>
            <div class="tarjeta-metrica__datos">
              <span class="tarjeta-metrica__etiqueta">Puntos Totales</span>
              <div class="tarjeta-metrica__valor">${puntos} <span class="tarjeta-metrica__sufijo">pts</span></div>
            </div>
          </div>

          <div class="tarjeta-metrica">
            <div class="tarjeta-metrica__icono tarjeta-metrica__icono--quiz" aria-hidden="true">🎯</div>
            <div class="tarjeta-metrica__datos">
              <span class="tarjeta-metrica__etiqueta">Nivel de Quiz Máx.</span>
              <div class="tarjeta-metrica__valor">${nivelQuiz > 0 ? `Nivel ${nivelQuiz}` : '—'}</div>
            </div>
          </div>

          <div class="tarjeta-metrica">
            <div class="tarjeta-metrica__icono tarjeta-metrica__icono--temas" aria-hidden="true">📚</div>
            <div class="tarjeta-metrica__datos">
              <span class="tarjeta-metrica__etiqueta">Temas Revisados</span>
              <div class="tarjeta-metrica__valor">${pctTemas}<span class="tarjeta-metrica__sufijo">%</span></div>
            </div>
          </div>

          <div class="tarjeta-metrica">
            <div class="tarjeta-metrica__icono tarjeta-metrica__icono--promedio" aria-hidden="true">📊</div>
            <div class="tarjeta-metrica__datos">
              <span class="tarjeta-metrica__etiqueta">Promedio General</span>
              <div class="tarjeta-metrica__valor">${promedioTexto} <span class="tarjeta-metrica__sufijo">${promedio !== null ? '/ 10' : ''}</span></div>
            </div>
          </div>
        </section>

        <!-- 2. Gráficos Chart.js -->
        <section class="progreso-graficos-grid" aria-label="Gráficos de rendimiento">
          <div class="tarjeta-grafico">
            <header class="tarjeta-grafico__cabecera">
              <h2 class="tarjeta-grafico__titulo">Evolución de Rendimiento</h2>
              <p class="tarjeta-grafico__descripcion">Promedio de calificaciones en las últimas semanas con actividad</p>
            </header>
            <div class="tarjeta-grafico__lienzo">
              <canvas id="grafico-evolucion" aria-label="Gráfico de línea de evolución"></canvas>
            </div>
          </div>

          <div class="tarjeta-grafico">
            <header class="tarjeta-grafico__cabecera">
              <h2 class="tarjeta-grafico__titulo">Promedio por Actividad</h2>
              <p class="tarjeta-grafico__descripcion">Rendimiento según la modalidad de juego o evaluación formativa</p>
            </header>
            <div class="tarjeta-grafico__lienzo">
              <canvas id="grafico-actividades" aria-label="Gráfico de barras por actividad"></canvas>
            </div>
          </div>
        </section>

        <!-- 3. Lista de pendientes -->
        <section class="progreso-pendientes-seccion" aria-labelledby="titulo-pendientes">
          <h2 id="titulo-pendientes" class="progreso-pendientes-seccion__titulo">Temas Pendientes de Revisión</h2>
          <p class="progreso-pendientes-seccion__descripcion">
            Temas formativos disponibles en tus asignaturas que aún no has completado
          </p>
          <div class="pendientes-lista" role="list">
            ${listaPendientesHtml}
          </div>
        </section>
      </div>
    `;

    // Inicializar gráficos tras montar el HTML
    const canvasEvolucion = document.getElementById('grafico-evolucion');
    if (canvasEvolucion) {
      montarGraficoEvolucion(canvasEvolucion, resumen.evolucion);
    }

    const canvasActividades = document.getElementById('grafico-actividades');
    if (canvasActividades) {
      montarGraficoActividades(canvasActividades, resumen.porActividad);
    }

  } catch (err) {
    console.error('Error al cargar progreso del estudiante:', err);
    aviso(err.message || 'No se pudo cargar el resumen de progreso', 'error');
    contenido.innerHTML = `
      <div class="vacio" style="margin-top: var(--espacio-xl);">
        <span class="vacio__icono">⚠️</span>
        <h2 class="vacio__titulo">Error al cargar datos</h2>
        <p class="vacio__texto">${escapar(err.message || 'Ocurrió un problema al obtener tu progreso.')}</p>
        <button type="button" class="btn btn--primario" onclick="location.reload()">Reintentar</button>
      </div>
    `;
  } finally {
    cargando(false);
  }
}
