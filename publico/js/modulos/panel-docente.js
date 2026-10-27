// publico/js/modulos/panel-docente.js · Panel docente de rendimiento y exportación CSV
import { montarPlantilla } from '../nucleo/plantilla.js';
import { llamar, listar, actualizar, crear } from '../nucleo/api.js';
import { escapar, modal, aviso, cargando } from '../nucleo/ui.js';
import { fechaRelativa, fechaCorta } from '../nucleo/util.js';

await montarPlantilla({ titulo: "Panel Docente", roles: ["docente", "admin"] });

const contenido = document.getElementById('contenido');

// Variables de estado
let gruposDisponibles = [];
let grupoActualId = null;
let datosGrupoActual = null;
let datosTutorActual = null;
let instanciaGrafico = null;
let instanciaGraficoTutor = null;
let columnaOrden = 'nombre';
let ordenAsc = true;

// Colores institucionales de tokens.css
const COLOR_PRIMARIO = '#002e45';
const COLOR_ACENTO = '#ff6900';
const COLOR_BORDE = '#dfe7ec';
const COLOR_TEXTO_SUAVE = '#627586';

// 1. Cargar grupos del docente / admin
async function cargarGrupos() {
  try {
    const distributivo = await listar('distributivo');
    const asignaturas = await listar('asignaturas');
    const mapaAsig = new Map((asignaturas || []).map(a => [a.id, a]));

    gruposDisponibles = (distributivo || []).map(g => {
      const asig = mapaAsig.get(g.asignaturaId);
      const nombreAsig = asig ? asig.nombre : 'Asignatura';
      const paralelo = g.paralelo ? `Paralelo ${g.paralelo}` : '';
      const periodo = g.periodo ? `(${g.periodo})` : '';
      return {
        id: g.id,
        texto: `${nombreAsig} - ${paralelo} ${periodo}`.trim(),
        asignaturaNombre: nombreAsig,
        paralelo: g.paralelo,
        periodo: g.periodo
      };
    });

    if (gruposDisponibles.length > 0) {
      grupoActualId = gruposDisponibles[0].id;
    }
  } catch (err) {
    console.error('Error al cargar distributivo:', err);
    aviso('No se pudo cargar la lista de grupos', 'error');
  }
}

// 2. Cargar datos del grupo seleccionado
async function cargarDatosGrupo(grupoId) {
  if (!grupoId) return;
  cargando(true);
  try {
    [datosGrupoActual, datosTutorActual] = await Promise.all([
      llamar('GET', `/api/resumen/grupo/${encodeURIComponent(grupoId)}`),
      llamar('GET', `/api/resumen/tutor/${encodeURIComponent(grupoId)}?incluirHistorial=1`)
    ]);
    if (!Object.hasOwn(datosTutorActual || {}, 'historial')) {
      aviso('El servidor está desactualizado. Reinícialo para habilitar la revisión del historial del tutor.', 'advertencia');
    }
    renderizarTodo();
  } catch (err) {
    console.error('Error al cargar resumen del grupo:', err);
    aviso(err.message || 'Error al obtener datos del grupo', 'error');
  } finally {
    cargando(false);
  }
}

function renderizarGraficoTutor(porTema) {
  const canvas = document.getElementById('grafico-uso-tutor');
  if (!canvas) return;
  if (instanciaGraficoTutor) instanciaGraficoTutor.destroy();

  const principales = [...(porTema || [])]
    .filter(item => Number(item.consultas) > 0)
    .sort((a, b) => Number(b.consultas) - Number(a.consultas))
    .slice(0, 5);

  if (!principales.length) {
    canvas.parentElement.innerHTML = '<div class="vacio"><p class="vacio__texto">Aún no hay consultas al tutor en este grupo.</p></div>';
    instanciaGraficoTutor = null;
    return;
  }

  /* global Chart */
  instanciaGraficoTutor = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: principales.map(item => item.titulo || 'Tema'),
      datasets: [{
        label: 'Consultas',
        data: principales.map(item => Number(item.consultas) || 0),
        backgroundColor: COLOR_PRIMARIO,
        hoverBackgroundColor: COLOR_ACENTO,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { precision: 0, color: COLOR_TEXTO_SUAVE },
          grid: { color: COLOR_BORDE }
        },
        y: {
          ticks: { color: COLOR_TEXTO_SUAVE },
          grid: { display: false }
        }
      }
    }
  });
}

async function abrirHistorialTutor(usuarioId, nombre) {
  const registros = (datosTutorActual?.historial || [])
    .filter(item => String(item.usuarioId) === String(usuarioId));
  const contenedor = document.createElement('div');
  contenedor.className = 'panel-tutor-historial';
  contenedor.innerHTML = registros.length
    ? registros.map(item => `
        <article class="panel-tutor-intercambio">
          <header>
            <strong>${escapar(item.tema || 'Tema')}</strong>
            <span>${escapar(item.fecha ? fechaCorta(item.fecha) : '')}</span>
          </header>
          <div class="panel-tutor-mensaje panel-tutor-mensaje--estudiante">
            <strong>Estudiante</strong>
            <p>${escapar(item.pregunta || '')}</p>
          </div>
          <div class="panel-tutor-mensaje panel-tutor-mensaje--tutor">
            <strong>Canelo</strong>
            <p>${escapar(item.respuesta || '')}</p>
          </div>
        </article>
      `).join('')
    : '<div class="vacio"><p class="vacio__texto">Este estudiante no ha autorizado conversaciones para revisión.</p></div>';
  await modal({
    titulo: `Historial del tutor: ${nombre}`,
    contenido: contenedor,
    acciones: [{ texto: 'Cerrar', valor: true, clase: 'btn--secundario' }]
  });
}

// 3. Renderizar gráfico de barras por tema
function renderizarGraficoTemas(porTema) {
  const canvas = document.getElementById('grafico-temas-docente');
  if (!canvas) return;

  if (instanciaGrafico) {
    instanciaGrafico.destroy();
    instanciaGrafico = null;
  }

  if (!porTema || porTema.length === 0) {
    canvas.parentElement.innerHTML = `
      <div class="vacio" style="height: 100%; border: none; padding: var(--espacio-l);">
        <span class="vacio__icono">📊</span>
        <h4 class="vacio__titulo">Sin datos de temas</h4>
        <p class="vacio__texto">Aún no se registran actividades evaluadas en los temas de este grupo.</p>
      </div>
    `;
    return;
  }

  const etiquetas = porTema.map(t => t.titulo || 'Tema');
  const valores = porTema.map(t => (typeof t.promedio === 'number' ? t.promedio : 0));

  /* global Chart */
  instanciaGrafico = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: etiquetas,
      datasets: [{
        label: 'Promedio (/10)',
        data: valores,
        backgroundColor: COLOR_PRIMARIO,
        hoverBackgroundColor: COLOR_ACENTO,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `Promedio: ${ctx.parsed.y} / 10 (${porTema[ctx.dataIndex]?.intentos || 0} intentos)`
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
          grid: { color: COLOR_BORDE }
        },
        x: {
          ticks: {
            color: COLOR_TEXTO_SUAVE,
            font: { family: 'Poppins, Arial, sans-serif' },
            callback: function(val, index) {
              const label = this.getLabelForValue(val);
              return label.length > 25 ? label.slice(0, 23) + '…' : label;
            }
          },
          grid: { display: false }
        }
      }
    }
  });
}

// 4. Ordenar estudiantes
function ordenarEstudiantes(lista) {
  if (!Array.isArray(lista)) return [];
  const copia = [...lista];

  copia.sort((a, b) => {
    let valorA;
    let valorB;

    switch (columnaOrden) {
      case 'nombre':
        valorA = `${a.nombre || ''} ${a.apellido || ''}`.trim().toLowerCase();
        valorB = `${b.nombre || ''} ${b.apellido || ''}`.trim().toLowerCase();
        return ordenAsc ? valorA.localeCompare(valorB) : valorB.localeCompare(valorA);

      case 'promedio':
        valorA = typeof a.promedio === 'number' ? a.promedio : -1;
        valorB = typeof b.promedio === 'number' ? b.promedio : -1;
        break;

      case 'actividades':
        valorA = Number(a.actividades) || 0;
        valorB = Number(b.actividades) || 0;
        break;

      case 'pctTemas':
        valorA = Number(a.pctTemas) || 0;
        valorB = Number(b.pctTemas) || 0;
        break;

      case 'ultimaConexion':
        valorA = a.ultimaConexion ? new Date(a.ultimaConexion).getTime() : 0;
        valorB = b.ultimaConexion ? new Date(b.ultimaConexion).getTime() : 0;
        break;

      case 'alertas':
        valorA = Number(a.alertasActivas) || 0;
        valorB = Number(b.alertasActivas) || 0;
        break;

      default:
        return 0;
    }

    if (valorA < valorB) return ordenAsc ? -1 : 1;
    if (valorA > valorB) return ordenAsc ? 1 : -1;
    return 0;
  });

  return copia;
}

// 5. Modal de detalle de estudiante con sus últimos 20 intentos
async function abrirDetalleEstudiante(estudianteId, nombreCompleto) {
  cargando(true);
  try {
    const resumen = await llamar('GET', `/api/resumen/estudiante/${estudianteId}`);

    const puntos = typeof resumen.puntos === 'number' ? resumen.puntos : 0;
    const nivelQuiz = typeof resumen.nivelQuizMax === 'number' ? resumen.nivelQuizMax : 0;
    const pctTemas = typeof resumen.pctTemas === 'number' ? resumen.pctTemas : 0;
    const promedio = typeof resumen.promedio === 'number' ? resumen.promedio.toFixed(1) : '—';
    const ultimos = Array.isArray(resumen.ultimosIntentos) ? resumen.ultimosIntentos : [];

    let filasIntentosHtml = '';
    if (ultimos.length === 0) {
      filasIntentosHtml = `<tr><td colspan="5" style="text-align: center; color: var(--texto-suave);">Sin intentos registrados</td></tr>`;
    } else {
      filasIntentosHtml = ultimos.map(it => {
        const actNombre = it.actividad ? it.actividad.toUpperCase() : 'GENERAL';
        const nota = (typeof it.puntaje === 'number' && typeof it.maximo === 'number' && it.maximo > 0)
          ? `${it.puntaje}/${it.maximo} (${((it.puntaje / it.maximo) * 10).toFixed(1)})`
          : '—';
        const tiempo = it.duracionSeg ? `${it.duracionSeg}s` : '0s';
        const fecha = it.fecha ? fechaCorta(it.fecha) : '—';
        const pts = typeof it.puntos === 'number' ? `+${it.puntos}` : '0';

        return `
          <tr>
            <td><strong>${escapar(actNombre)}</strong></td>
            <td>${escapar(nota)}</td>
            <td>${escapar(pts)}</td>
            <td>${escapar(tiempo)}</td>
            <td>${escapar(fecha)}</td>
          </tr>
        `;
      }).join('');
    }

    const contenidoModal = document.createElement('div');
    contenidoModal.className = 'modal-estudiante-pila';
    contenidoModal.innerHTML = `
      <div class="modal-metricas-grid">
        <div class="modal-metrica-caja">
          <span class="modal-metrica-etiqueta">Puntos Totales</span>
          <div class="modal-metrica-valor">${puntos}</div>
        </div>
        <div class="modal-metrica-caja">
          <span class="modal-metrica-etiqueta">Nivel Quiz</span>
          <div class="modal-metrica-valor">${nivelQuiz > 0 ? `Nivel ${nivelQuiz}` : '—'}</div>
        </div>
        <div class="modal-metrica-caja">
          <span class="modal-metrica-etiqueta">Temas Revisados</span>
          <div class="modal-metrica-valor">${pctTemas}%</div>
        </div>
        <div class="modal-metrica-caja">
          <span class="modal-metrica-etiqueta">Promedio General</span>
          <div class="modal-metrica-valor">${promedio}</div>
        </div>
      </div>

      <div>
        <h4 style="margin: 0 0 var(--espacio-s); font-size: var(--tamano-s); color: var(--primario);">
          Últimos 20 intentos de actividades
        </h4>
        <div class="modal-intentos-contenedor">
          <table class="tabla" style="margin: 0;">
            <thead>
              <tr>
                <th>Actividad</th>
                <th>Calificación</th>
                <th>Puntos</th>
                <th>Duración</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              ${filasIntentosHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;

    cargando(false);

    await modal({
      titulo: `Progreso: ${nombreCompleto}`,
      contenido: contenidoModal,
      acciones: [
        { texto: 'Cerrar', valor: true, clase: 'btn btn--secundario' }
      ]
    });
  } catch (err) {
    console.error('Error al abrir detalle de estudiante:', err);
    aviso(err.message || 'No se pudo cargar el detalle del estudiante', 'error');
  } finally {
    cargando(false);
  }
}

// 5b. Modal de gestión de alertas tempranas de un estudiante
async function abrirModalAlertasEstudiante(estudianteId, nombreCompleto) {
  if (!estudianteId) return;
  cargando(true);
  try {
    const respuesta = await llamar('GET', `/api/alertas?grupoId=${encodeURIComponent(grupoActualId)}&estudianteId=${encodeURIComponent(estudianteId)}`);
    const alertas = Array.isArray(respuesta.alertas) ? respuesta.alertas : [];
    const mensajesApoyo = Array.isArray(respuesta.mensajesApoyo) ? respuesta.mensajesApoyo : [];

    const contenedor = document.createElement('div');
    contenedor.className = 'modal-alertas-lista';

    if (alertas.length === 0) {
      contenedor.innerHTML = `
        <div class="vacio" style="border: none; padding: var(--espacio-l);">
          <span class="vacio__icono">✅</span>
          <h4 class="vacio__titulo">Sin alertas registradas</h4>
          <p class="vacio__texto">Este estudiante no tiene alertas de rendimiento ni de inactividad.</p>
        </div>
      `;
    } else {
      let tarjetasHtml = '';
      alertas.forEach(alerta => {
        const esActiva = alerta.estado === 'activa';
        const claseEstado = esActiva ? 'alerta-tarjeta--activa' : 'alerta-tarjeta--atendida';
        const etiquetaEstado = esActiva
          ? `<span class="insignia insignia--error">Activa</span>`
          : `<span class="insignia insignia--exito">Atendida</span>`;

        let reglaTexto = 'Rendimiento general';
        if (alerta.regla === 'promedioBajo') reglaTexto = '📉 Promedio bajo';
        else if (alerta.regla === 'fallosQuiz') reglaTexto = '❓ Dificultad reiterada en Quiz';
        else if (alerta.regla === 'inactividad') reglaTexto = '⏱️ Inactividad prolongada';

        const fechaTexto = alerta.fecha ? fechaRelativa(alerta.fecha) : '';

        tarjetasHtml += `
          <div class="alerta-tarjeta ${claseEstado}" data-alerta-id="${escapar(alerta.id)}">
            <div class="alerta-tarjeta__cabecera">
              <span class="alerta-tarjeta__tipo">${escapar(reglaTexto)}</span>
              <div>
                ${etiquetaEstado}
                <span style="font-size: var(--tamano-xs); color: var(--texto-suave); margin-left: var(--espacio-xs);">${escapar(fechaTexto)}</span>
              </div>
            </div>
            <p class="alerta-tarjeta__detalle">${escapar(alerta.detalle || 'Requiere seguimiento docente.')}</p>
            <div class="alerta-tarjeta__acciones">
              ${esActiva ? `
                <button type="button" class="btn btn--primario btn--pequeno btn-atender-alerta" data-id="${escapar(alerta.id)}">
                  ✓ Marcar como atendida
                </button>
              ` : `
                <span style="font-size: var(--tamano-xs); color: var(--exito); font-weight: var(--peso-negrita);">✓ Alerta atendida</span>
              `}
            </div>
          </div>
        `;
      });

      // Opciones de mensajes predefinidos de apoyo
      const opcionesMensajesHtml = mensajesApoyo.map((msg, idx) => `
        <option value="${escapar(msg)}">${escapar(msg)}</option>
      `).join('');

      contenedor.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: var(--espacio-s);">
          ${tarjetasHtml}
        </div>

        <!-- Sección de envío de mensaje de apoyo -->
        <section class="bloque-apoyo" aria-labelledby="titulo-apoyo">
          <h4 id="titulo-apoyo" style="margin: 0; font-size: var(--tamano-s); color: var(--primario);">
            💌 Enviar mensaje de apoyo al estudiante
          </h4>
          <p style="margin: 0; font-size: var(--tamano-xs); color: var(--texto-suave);">
            Llegará como notificación directa al perfil del estudiante.
          </p>

          <div class="campo">
            <label for="select-mensaje-apoyo" class="campo__etiqueta">Mensajes recomendados:</label>
            <select id="select-mensaje-apoyo" class="campo__entrada">
              <option value="">-- Elige una sugerencia o escribe abajo --</option>
              ${opcionesMensajesHtml}
            </select>
          </div>

          <div class="campo">
            <label for="texto-mensaje-apoyo" class="campo__etiqueta">Mensaje personalizado o editado:</label>
            <textarea id="texto-mensaje-apoyo" class="campo__entrada" rows="3" placeholder="Escribe aquí un mensaje motivador..."></textarea>
          </div>

          <div>
            <button type="button" id="btn-enviar-apoyo" class="btn btn--acento btn--pequeno">
              📤 Enviar mensaje de apoyo
            </button>
          </div>
        </section>
      `;

      // Evento de selección de mensaje predefinido
      const selectMsg = contenedor.querySelector('#select-mensaje-apoyo');
      const textMsg = contenedor.querySelector('#texto-mensaje-apoyo');
      if (selectMsg && textMsg) {
        selectMsg.addEventListener('change', () => {
          if (selectMsg.value) {
            textMsg.value = selectMsg.value;
          }
        });
      }

      // Evento enviar mensaje de apoyo
      const btnEnviar = contenedor.querySelector('#btn-enviar-apoyo');
      if (btnEnviar && textMsg) {
        btnEnviar.addEventListener('click', async () => {
          const mensajeTexto = textMsg.value.trim();
          if (!mensajeTexto) {
            aviso('Por favor ingresa o selecciona un mensaje de apoyo', 'advertencia');
            return;
          }

          cargando(true);
          try {
            await llamar('POST', '/api/notificaciones', {
              usuarioId: estudianteId,
              mensaje: mensajeTexto,
              enlace: '/paginas/mi-progreso.html'
            });

            aviso('Mensaje de apoyo enviado con éxito', 'exito');
            textMsg.value = '';
            if (selectMsg) selectMsg.value = '';
          } catch (errNotif) {
            console.error('Error al enviar mensaje de apoyo:', errNotif);
            aviso(errNotif.message || 'No se pudo enviar el mensaje de apoyo', 'error');
          } finally {
            cargando(false);
          }
        });
      }

      // Evento marcar como atendida
      const btnsAtender = contenedor.querySelectorAll('.btn-atender-alerta');
      btnsAtender.forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const alertaId = btn.getAttribute('data-id');
          if (!alertaId) return;

          cargando(true);
          try {
            await actualizar('alertas', alertaId, { estado: 'atendida' });
            aviso('Alerta marcada como atendida', 'exito');

            // Actualizar tarjeta en el modal
            const tarjeta = contenedor.querySelector(`[data-alerta-id="${alertaId}"]`);
            if (tarjeta) {
              tarjeta.classList.remove('alerta-tarjeta--activa');
              tarjeta.classList.add('alerta-tarjeta--atendida');
              const accionesDiv = tarjeta.querySelector('.alerta-tarjeta__acciones');
              if (accionesDiv) {
                accionesDiv.innerHTML = `<span style="font-size: var(--tamano-xs); color: var(--exito); font-weight: var(--peso-negrita);">✓ Alerta atendida</span>`;
              }
              const cabeceraDiv = tarjeta.querySelector('.alerta-tarjeta__cabecera > div');
              if (cabeceraDiv) {
                cabeceraDiv.querySelector('.insignia')?.remove();
                cabeceraDiv.insertAdjacentHTML('afterbegin', `<span class="insignia insignia--exito">Atendida</span>`);
              }
            }

            // Recargar datos del grupo en segundo plano para actualizar contadores y chips
            if (grupoActualId) {
              await cargarDatosGrupo(grupoActualId);
            }
          } catch (errAtender) {
            console.error('Error al atender alerta:', errAtender);
            aviso(errAtender.message || 'No se pudo actualizar la alerta', 'error');
          } finally {
            cargando(false);
          }
        });
      });
    }

    cargando(false);

    await modal({
      titulo: `Alertas: ${nombreCompleto}`,
      contenido: contenedor,
      acciones: [
        { texto: 'Cerrar', valor: true, clase: 'btn btn--secundario' }
      ]
    });
  } catch (err) {
    console.error('Error al abrir alertas de estudiante:', err);
    aviso(err.message || 'No se pudieron consultar las alertas', 'error');
  } finally {
    cargando(false);
  }
}

// 6. Exportar CSV con separador punto y coma y BOM UTF-8
function exportarCsv() {
  if (!datosGrupoActual || !Array.isArray(datosGrupoActual.estudiantes) || datosGrupoActual.estudiantes.length === 0) {
    aviso('No hay datos de estudiantes para exportar en este grupo', 'advertencia');
    return;
  }

  const cabeceras = [
    'Estudiante',
    'Promedio (/10)',
    'Actividades Evaluables',
    'Temas Revisados (%)',
    'Ultima Conexion',
    'Alertas Activas'
  ];

  const filas = datosGrupoActual.estudiantes.map(est => {
    const nombre = `"${(est.nombre || '').replace(/"/g, '""')} ${(est.apellido || '').replace(/"/g, '""')}"`;
    const promedio = est.promedio !== null ? String(est.promedio).replace('.', ',') : 'N/A';
    const actividades = est.actividades || 0;
    const pctTemas = `${est.pctTemas || 0}%`;
    const conexion = est.ultimaConexion ? `"${new Date(est.ultimaConexion).toLocaleString('es-EC')}"` : '"Nunca"';
    const alertas = est.alertasActivas || 0;

    return [nombre, promedio, actividades, pctTemas, conexion, alertas].join(';');
  });

  const contenidoCsv = '\uFEFF' + [cabeceras.join(';'), ...filas].join('\r\n');
  const blob = new Blob([contenidoCsv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const enlace = document.createElement('a');
  enlace.href = url;
  const grupoSel = gruposDisponibles.find(g => g.id === grupoActualId);
  const nombreArchivo = `resumen-grupo-${grupoSel ? grupoSel.paralelo || grupoSel.id : 'export'}-${new Date().toISOString().slice(0, 10)}.csv`;
  enlace.setAttribute('download', nombreArchivo);
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);

  aviso('Archivo CSV exportado exitosamente', 'exito');
}

// 7. Renderizar vista principal
function renderizarTodo() {
  if (!contenido) return;

  if (gruposDisponibles.length === 0) {
    contenido.innerHTML = `
      <div class="panel-contenedor">
        <header class="panel-cabecera">
          <div>
            <h1 class="panel-cabecera__titulo">Panel Docente de Rendimiento</h1>
            <p class="panel-cabecera__subtitulo">Seguimiento académico y métricas de desempeño por grupo</p>
          </div>
        </header>
        <div class="vacio">
          <span class="vacio__icono">📚</span>
          <h2 class="vacio__titulo">Sin grupos asignados</h2>
          <p class="vacio__texto">No tienes paralelos asignados en el distributivo académico.</p>
        </div>
      </div>
    `;
    return;
  }

  const opcionesGruposHtml = gruposDisponibles.map(g => `
    <option value="${escapar(g.id)}" ${g.id === grupoActualId ? 'selected' : ''}>
      ${escapar(g.texto)}
    </option>
  `).join('');

  const estudiantesOrdenados = ordenarEstudiantes(datosGrupoActual ? datosGrupoActual.estudiantes : []);
  const consultasEstudiantes = [...(datosTutorActual?.porEstudiante || [])]
    .sort((a, b) => Number(b.consultas) - Number(a.consultas) || String(a.nombre).localeCompare(String(b.nombre), 'es'));
  const historialPorEstudiante = new Map();
  for (const item of datosTutorActual?.historial || []) {
    const clave = String(item.usuarioId);
    historialPorEstudiante.set(clave, (historialPorEstudiante.get(clave) || 0) + 1);
  }
  const filasTutorHtml = consultasEstudiantes.length
    ? consultasEstudiantes.map(item => {
        const compartidos = historialPorEstudiante.get(String(item.id)) || 0;
        return `
        <tr>
          <td>${escapar(item.nombre || 'Estudiante')}</td>
          <td><strong>${Number(item.consultas) || 0}</strong></td>
          <td>
            <button type="button" class="btn btn--texto btn--pequeno btn-historial-tutor" data-id="${escapar(item.id)}" data-nombre="${escapar(item.nombre || 'Estudiante')}" ${compartidos ? '' : 'disabled'}>
              Ver historial (${compartidos})
            </button>
          </td>
        </tr>
      `;
      }).join('')
    : '<tr><td colspan="3">No hay estudiantes en este grupo.</td></tr>';

  let filasEstudiantesHtml = '';
  if (estudiantesOrdenados.length === 0) {
    filasEstudiantesHtml = `
      <tr>
        <td colspan="6" style="text-align: center; padding: var(--espacio-l); color: var(--texto-suave);">
          No hay estudiantes matriculados en este paralelo.
        </td>
      </tr>
    `;
  } else {
    filasEstudiantesHtml = estudiantesOrdenados.map(est => {
      const tieneAlertas = Number(est.alertasActivas) > 0;
      const claseFila = `fila-estudiante ${tieneAlertas ? 'fila-alerta' : ''}`;
      const nombreCompleto = `${est.nombre || ''} ${est.apellido || ''}`.trim() || 'Estudiante';
      const promedio = est.promedio !== null ? est.promedio.toFixed(1) : '—';
      const conexion = est.ultimaConexion ? fechaRelativa(est.ultimaConexion) : 'Nunca';

      const chipAlertaHtml = tieneAlertas
        ? `<button type="button" class="chip-alerta chip-alerta--boton btn-abrir-alertas" data-id="${escapar(est.id)}" data-nombre="${escapar(nombreCompleto)}" title="Ver ${est.alertasActivas} alerta(s) de ${escapar(nombreCompleto)}">⚠️ ${est.alertasActivas}</button>`
        : `<button type="button" class="chip-sin-alerta chip-sin-alerta--boton btn-abrir-alertas" data-id="${escapar(est.id)}" data-nombre="${escapar(nombreCompleto)}" title="Sin alertas activas">0</button>`;

      return `
        <tr class="${claseFila}" data-id="${escapar(est.id)}" data-nombre="${escapar(nombreCompleto)}" tabindex="0" role="button" aria-label="Ver detalle de ${escapar(nombreCompleto)}">
          <td><strong>${escapar(nombreCompleto)}</strong></td>
          <td><span class="insignia insignia--info">${escapar(promedio)}</span></td>
          <td>${est.actividades || 0}</td>
          <td>${est.pctTemas || 0}%</td>
          <td>${escapar(conexion)}</td>
          <td>${chipAlertaHtml}</td>
        </tr>
      `;
    }).join('');
  }

  function iconoOrden(col) {
    if (columnaOrden !== col) return '↕';
    return ordenAsc ? '▲' : '▼';
  }

  contenido.innerHTML = `
    <div class="panel-contenedor">
      <!-- Cabecera -->
      <header class="panel-cabecera">
        <div>
          <h1 class="panel-cabecera__titulo">Panel Docente de Rendimiento</h1>
          <p class="panel-cabecera__subtitulo">Seguimiento académico grupal, alertas tempranas y exportación</p>
        </div>
        <div class="panel-acciones-superiores">
          <button type="button" id="btn-exportar-csv" class="btn btn--secundario">
            📥 Exportar CSV
          </button>
        </div>
      </header>

      <!-- Selector de grupos -->
      <div class="panel-filtro-bloque">
        <div class="panel-selector-grupo">
          <label for="select-grupo-docente">Grupo / Paralelo:</label>
          <select id="select-grupo-docente" class="campo__entrada">
            ${opcionesGruposHtml}
          </select>
        </div>
        <div>
          <span style="font-size: var(--tamano-s); color: var(--texto-suave);">
            Total: <strong>${estudiantesOrdenados.length}</strong> estudiantes
          </span>
        </div>
      </div>

      <!-- Gráfico de barras por tema -->
      <section class="panel-grafico-bloque" aria-labelledby="titulo-grafico-docente">
        <header class="panel-grafico-cabecera">
          <h2 id="titulo-grafico-docente" class="panel-grafico-titulo">Promedio de Calificaciones por Tema</h2>
          <p class="panel-grafico-descripcion">Rendimiento medio global de los estudiantes en cada tema formativo</p>
        </header>
        <div class="panel-grafico-lienzo">
          <canvas id="grafico-temas-docente" aria-label="Gráfico de barras por tema"></canvas>
        </div>
      </section>

      <section class="panel-grafico-bloque" aria-labelledby="titulo-uso-tutor">
        <header class="panel-grafico-cabecera">
          <h2 id="titulo-uso-tutor" class="panel-grafico-titulo">Uso del tutor</h2>
          <p class="panel-grafico-descripcion">Consultas acumuladas y conversaciones autorizadas por el estudiante para revisión educativa.</p>
        </header>
        <div class="panel-tutor-grid">
          <div>
            <h3 class="panel-tutor-subtitulo">Cinco temas más consultados</h3>
            <div class="panel-grafico-lienzo panel-grafico-lienzo--tutor">
              <canvas id="grafico-uso-tutor" aria-label="Gráfico horizontal de temas más consultados al tutor"></canvas>
            </div>
          </div>
          <div>
            <h3 class="panel-tutor-subtitulo">Consultas por estudiante</h3>
            <div class="tabla-contenedor panel-tutor-tabla">
              <table class="tabla">
                <thead><tr><th>Estudiante</th><th>Consultas</th><th>Revisión autorizada</th></tr></thead>
                <tbody>${filasTutorHtml}</tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <!-- Tabla de estudiantes ordenable -->
      <section class="panel-tabla-bloque" aria-labelledby="titulo-tabla-estudiantes">
        <header class="panel-tabla-cabecera">
          <div>
            <h2 id="titulo-tabla-estudiantes" class="panel-tabla-titulo">Desempeño Individual de Estudiantes</h2>
            <p class="panel-tabla-descripcion">Haz clic en cualquier fila para consultar el resumen y los últimos 20 intentos</p>
          </div>
        </header>

        <div class="tabla-contenedor">
          <table class="tabla" role="table">
            <thead>
              <tr>
                <th class="th-ordenable" data-col="nombre" tabindex="0" role="columnheader">
                  <span class="th-ordenable__contenido">Estudiante <span class="th-ordenable__icono">${iconoOrden('nombre')}</span></span>
                </th>
                <th class="th-ordenable" data-col="promedio" tabindex="0" role="columnheader">
                  <span class="th-ordenable__contenido">Promedio <span class="th-ordenable__icono">${iconoOrden('promedio')}</span></span>
                </th>
                <th class="th-ordenable" data-col="actividades" tabindex="0" role="columnheader">
                  <span class="th-ordenable__contenido">Actividades <span class="th-ordenable__icono">${iconoOrden('actividades')}</span></span>
                </th>
                <th class="th-ordenable" data-col="pctTemas" tabindex="0" role="columnheader">
                  <span class="th-ordenable__contenido">% Temas <span class="th-ordenable__icono">${iconoOrden('pctTemas')}</span></span>
                </th>
                <th class="th-ordenable" data-col="ultimaConexion" tabindex="0" role="columnheader">
                  <span class="th-ordenable__contenido">Última Conexión <span class="th-ordenable__icono">${iconoOrden('ultimaConexion')}</span></span>
                </th>
                <th class="th-ordenable" data-col="alertas" tabindex="0" role="columnheader">
                  <span class="th-ordenable__contenido">Alertas <span class="th-ordenable__icono">${iconoOrden('alertas')}</span></span>
                </th>
              </tr>
            </thead>
            <tbody>
              ${filasEstudiantesHtml}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;

  // Asignar eventos
  const selectGrupo = document.getElementById('select-grupo-docente');
  if (selectGrupo) {
    selectGrupo.addEventListener('change', async (e) => {
      grupoActualId = e.target.value;
      await cargarDatosGrupo(grupoActualId);
    });
  }

  const btnExportar = document.getElementById('btn-exportar-csv');
  if (btnExportar) {
    btnExportar.addEventListener('click', exportarCsv);
  }

  document.querySelectorAll('.btn-historial-tutor').forEach(boton => {
    boton.addEventListener('click', () => abrirHistorialTutor(boton.dataset.id, boton.dataset.nombre));
  });

  // Ordenamiento de tabla por clic en encabezados
  const encabezados = document.querySelectorAll('.th-ordenable');
  encabezados.forEach(th => {
    const accionOrdenar = () => {
      const col = th.getAttribute('data-col');
      if (columnaOrden === col) {
        ordenAsc = !ordenAsc;
      } else {
        columnaOrden = col;
        ordenAsc = true;
      }
      renderizarTodo();
    };

    th.addEventListener('click', accionOrdenar);
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        accionOrdenar();
      }
    });
  });

  // Clic en fila de estudiante para abrir modal de detalle
  const filas = document.querySelectorAll('.fila-estudiante');
  filas.forEach(fila => {
    const estId = fila.getAttribute('data-id');
    const estNombre = fila.getAttribute('data-nombre');

    const accionVer = () => abrirDetalleEstudiante(estId, estNombre);

    fila.addEventListener('click', accionVer);
    fila.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        accionVer();
      }
    });
  });

  // Clic en chip de alerta para abrir modal de alertas
  const chipsAlerta = document.querySelectorAll('.btn-abrir-alertas');
  chipsAlerta.forEach(chip => {
    const estId = chip.getAttribute('data-id');
    const estNombre = chip.getAttribute('data-nombre');

    const accionAlertas = (e) => {
      e.stopPropagation();
      abrirModalAlertasEstudiante(estId, estNombre);
    };

    chip.addEventListener('click', accionAlertas);
    chip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        accionAlertas(e);
      }
    });
  });

  // Renderizar gráfico
  if (datosGrupoActual && datosGrupoActual.porTema) {
    renderizarGraficoTemas(datosGrupoActual.porTema);
  }
  renderizarGraficoTutor(datosTutorActual?.porTema || []);
}

// Inicialización
cargando(true);
try {
  await cargarGrupos();
  if (grupoActualId) {
    await cargarDatosGrupo(grupoActualId);
  } else {
    renderizarTodo();
  }
} finally {
  cargando(false);
}
