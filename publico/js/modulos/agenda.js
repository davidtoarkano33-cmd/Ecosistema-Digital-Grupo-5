// publico/js/modulos/agenda.js · Agenda académica y personal con FullCalendar, próximos eventos y festividades
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as sesion from '../nucleo/sesion.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';
import { esDocenteDeGrupo } from '../nucleo/distributivo.js';

await montarPlantilla({ titulo: 'Agenda', roles: ['sesion'] });

const usuario = sesion.usuarioActual();
const esDocenteOAdmin = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');

const MESES_ABR = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const MESES_NOM = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const COLORES_POR_TIPO = {
  'tarea': { fondo: 'var(--info)', borde: 'var(--info)', texto: 'var(--texto-inverso)', etiqueta: '📌 Tarea' },
  'reunion': { fondo: 'var(--secundario)', borde: 'var(--secundario)', texto: 'var(--texto-inverso)', etiqueta: '👥 Reunión' },
  'fecha-limite': { fondo: 'var(--error)', borde: 'var(--error)', texto: 'var(--texto-inverso)', etiqueta: '⏰ Fecha límite' },
  'recordatorio': { fondo: 'var(--advertencia)', borde: 'var(--advertencia)', texto: 'var(--texto-inverso)', etiqueta: '🔔 Recordatorio' },
  'festividad': { fondo: 'var(--acento)', borde: 'var(--advertencia)', texto: 'var(--texto-inverso)', etiqueta: '🇪🇨 Festividad' }
};

let eventos = [];
let intentos = [];
let gruposDocente = [];
let temas = [];
let calendarioInstancia = null;
let filtroActual = 'todos';

const contenedor = document.getElementById('contenido');

contenedor.innerHTML = `
  <section class="agenda-layout">
    <header class="agenda-cabecera">
      <div>
        <h1>Mi Agenda Académica e Institucional</h1>
        <p class="texto-suave">Eventos de instituto, festividades oficiales de Ecuador, tareas y fechas límite para todos.</p>
      </div>
      <div class="agenda-acciones-top">
        <div class="agenda-leyenda">
          <span class="leyenda-item"><span class="leyenda-dot leyenda-dot--festividad"></span> Festividad</span>
          <span class="leyenda-item"><span class="leyenda-dot leyenda-dot--tarea"></span> Tarea</span>
          <span class="leyenda-item"><span class="leyenda-dot leyenda-dot--reunion"></span> Reunión</span>
          <span class="leyenda-item"><span class="leyenda-dot leyenda-dot--fecha-limite"></span> Fecha límite</span>
          <span class="leyenda-item"><span class="leyenda-dot leyenda-dot--recordatorio"></span> Recordatorio</span>
        </div>
        <button type="button" id="btn-nuevo-evento" class="btn btn--primario">
          ➕ Nuevo evento
        </button>
      </div>
    </header>

    <!-- Sección superior obligatoria: Próximos eventos (incluye Navidad, festividades y fechas futuras) -->
    <section class="proximos-seccion" aria-labelledby="titulo-proximos">
      <div class="proximos-cabecera">
        <h2 id="titulo-proximos">📅 Próximos eventos y actividades</h2>
        <div class="filtros-proximos" role="toolbar" aria-label="Filtros de próximos eventos">
          <button type="button" class="btn-filtro activo" data-filtro="todos">Todos los próximos</button>
          <button type="button" class="btn-filtro" data-filtro="semana">Próximos 7 días</button>
          <button type="button" class="btn-filtro" data-filtro="mes">Este mes</button>
          <button type="button" class="btn-filtro" data-filtro="festividades">Festividades Ecuador</button>
          <button type="button" class="btn-filtro" data-filtro="fechas-limite">Fechas límite y tareas</button>
        </div>
      </div>
      <div id="lista-proximos" class="proximos-lista" role="list"></div>
    </section>

    <!-- Calendario interactivo FullCalendar -->
    <div class="calendario-card">
      <div id="calendario"></div>
    </div>
  </section>

  <!-- Modal para Crear / Editar Evento -->
  <dialog id="modal-evento" class="modal-dialogo" aria-labelledby="modal-evento-titulo">
    <form id="form-evento" method="dialog" class="modal-cuerpo">
      <h2 id="modal-evento-titulo" class="modal-titulo">Nuevo evento</h2>

      <div class="modal-agenda-grid">
        <div class="campo campo--full">
          <label for="ev-titulo">Título del evento *</label>
          <input type="text" id="ev-titulo" required placeholder="Ej. Navidad, Entrega de informe, etc.">
        </div>

        <div class="campo">
          <label for="ev-tipo">Tipo de evento *</label>
          <select id="ev-tipo" required>
            <option value="recordatorio">Recordatorio</option>
            <option value="tarea">Tarea</option>
            <option value="reunion">Reunión</option>
            <option value="fecha-limite">Fecha límite</option>
            <option value="festividad">Festividad / Feriado</option>
          </select>
        </div>

        <div class="campo">
          <label for="ev-todo-el-dia" class="checkbox-label" style="margin-top: 32px;">
            <input type="checkbox" id="ev-todo-el-dia" checked> Todo el día
          </label>
        </div>

        <div class="campo">
          <label for="ev-inicio">Inicio *</label>
          <input type="date" id="ev-inicio" required>
        </div>

        <div class="campo">
          <label for="ev-fin">Fin</label>
          <input type="date" id="ev-fin">
        </div>

        <div class="campo campo--full">
          <label>Recordatorios previos:</label>
          <div class="grupo-checkboxes">
            <label class="checkbox-label">
              <input type="checkbox" id="rec-dia" value="1440" checked> 1 día antes
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="rec-hora" value="60" checked> 1 hora antes
            </label>
          </div>
        </div>

        <!-- Campos de alcance y actividad para docentes y admin -->
        <div id="seccion-docente" class="campo--full modal-agenda-grid" style="display: none; padding-top: var(--espacio-s); border-top: 1px solid var(--borde);">
          <div class="campo campo--full">
            <label for="ev-grupo">Alcance del evento (Notificará a los participantes):</label>
            <select id="ev-grupo">
              <option value="todos" selected>Para todos (Institucional / Toda la comunidad)</option>
              <option value="">Personal (solo para mí)</option>
            </select>
          </div>

          <div class="campo">
            <label for="ev-actividad">Actividad vinculada (Opcional):</label>
            <select id="ev-actividad">
              <option value="">Ninguna</option>
            </select>
          </div>

          <div class="campo">
            <label for="ev-tema">Tema de la actividad:</label>
            <select id="ev-tema">
              <option value="">Ninguno</option>
            </select>
          </div>
        </div>
      </div>

      <div class="modal-agenda-acciones">
        <div>
          <button type="button" id="btn-eliminar-evento" class="btn btn--peligro" style="display: none;">
            🗑️ Eliminar
          </button>
        </div>
        <div style="display: flex; gap: var(--espacio-s);">
          <button type="button" id="btn-cancelar-modal" class="btn btn--secundario">
            Cancelar
          </button>
          <button type="submit" id="btn-guardar-evento" class="btn btn--primario">
            Guardar evento
          </button>
        </div>
      </div>
    </form>
  </dialog>
`;

const modalEvento = document.getElementById('modal-evento');
const formEvento = document.getElementById('form-evento');
const modalTitulo = document.getElementById('modal-evento-titulo');
const inputTitulo = document.getElementById('ev-titulo');
const selectTipo = document.getElementById('ev-tipo');
const checkTodoElDia = document.getElementById('ev-todo-el-dia');
const inputInicio = document.getElementById('ev-inicio');
const inputFin = document.getElementById('ev-fin');
const checkRecDia = document.getElementById('rec-dia');
const checkRecHora = document.getElementById('rec-hora');
const seccionDocente = document.getElementById('seccion-docente');
const selectGrupo = document.getElementById('ev-grupo');
const selectActividad = document.getElementById('ev-actividad');
const selectTema = document.getElementById('ev-tema');
const btnEliminarEvento = document.getElementById('btn-eliminar-evento');
const btnCancelarModal = document.getElementById('btn-cancelar-modal');
const btnNuevoEvento = document.getElementById('btn-nuevo-evento');
const listaProximos = document.getElementById('lista-proximos');
const botonesFiltros = document.querySelectorAll('.btn-filtro');

let eventoEditandoId = null;

// Poblar selector de actividades
ACTIVIDADES.forEach(act => {
  const opt = document.createElement('option');
  opt.value = act.id;
  opt.textContent = act.texto;
  selectActividad.appendChild(opt);
});

/**
 * Filtros de la sección superior de próximos eventos
 */
botonesFiltros.forEach(btn => {
  btn.addEventListener('click', () => {
    botonesFiltros.forEach(b => b.classList.remove('activo'));
    btn.classList.add('activo');
    filtroActual = btn.dataset.filtro;
    renderizarProximosEventos();
  });
});

/**
 * Valida si un evento fecha-limite con actividad y tema fue cumplido por el estudiante.
 */
function estaCumplido(ev) {
  if (ev.tipo !== 'fecha-limite' || !ev.actividad || !ev.temaId) {
    return false;
  }
  const fechaReferencia = new Date(ev.fecha || ev.inicio);
  return intentos.some(it => {
    if (it.actividad !== ev.actividad || it.temaId !== ev.temaId) return false;
    const fechaIntento = new Date(it.fecha);
    return fechaIntento >= fechaReferencia;
  });
}

/**
 * Formatea fechas para inputs tipo datetime-local o date
 */
function aValorInputFecha(fechaIso, soloFecha = false) {
  if (!fechaIso) return '';
  const d = new Date(fechaIso);
  const pad = n => String(n).padStart(2, '0');
  const yyyy = soloFecha ? d.getUTCFullYear() : d.getFullYear();
  const mm = pad((soloFecha ? d.getUTCMonth() : d.getMonth()) + 1);
  const dd = pad(soloFecha ? d.getUTCDate() : d.getDate());
  if (soloFecha) return `${yyyy}-${mm}-${dd}`;
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

/**
 * Calcula texto relativo amigable de cuenta regresiva
 */
function calcularTextoCuenta(fechaEv, esTodoElDia) {
  const ahora = new Date();
  const f = new Date(fechaEv);
  const hoyMediaNoche = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const evMediaNoche = new Date(f.getFullYear(), f.getMonth(), f.getDate());

  const diffDias = Math.round((evMediaNoche - hoyMediaNoche) / (1000 * 60 * 60 * 24));

  if (diffDias < 0) return '⚠️ Vencido';
  if (diffDias === 0) return '📍 ¡Hoy!';
  if (diffDias === 1) return 'Mañana';
  if (diffDias <= 7) return `En ${diffDias} días`;
  if (diffDias <= 30) return `En ${Math.round(diffDias / 7)} semanas`;
  return `En ${MESES_NOM[f.getMonth()]} (${f.getDate()} de ${MESES_NOM[f.getMonth()]})`;
}

/**
 * Abre el modal para crear o editar evento.
 */
function abrirModal(evento = null, fechaPorDefecto = null) {
  eventoEditandoId = evento ? evento.id : null;
  modalTitulo.textContent = evento ? 'Editar evento' : 'Nuevo evento';

  if (esDocenteOAdmin) {
    seccionDocente.style.display = 'grid';
  } else {
    seccionDocente.style.display = 'none';
  }

  const esPropietario = evento ? (String(evento.propietarioId) === String(usuario.id) || usuario.rol === 'admin') : true;

  if (evento) {
    inputTitulo.value = evento.titulo || '';
    selectTipo.value = evento.tipo || 'recordatorio';
    checkTodoElDia.checked = Boolean(evento.todoElDia);
    ajustarInputsFechaSegunTodoElDia(Boolean(evento.todoElDia));

    inputInicio.value = aValorInputFecha(evento.inicio, evento.todoElDia);
    inputFin.value = aValorInputFecha(evento.fin, evento.todoElDia);

    const recs = Array.isArray(evento.recordatorios) ? evento.recordatorios : [];
    checkRecDia.checked = recs.includes(1440);
    checkRecHora.checked = recs.includes(60);

    if (esDocenteOAdmin) {
      selectGrupo.value = evento.esInstitucional || evento.grupoId === 'todos' ? 'todos' : (evento.grupoId || '');
      selectActividad.value = evento.actividad || '';
      selectTema.value = evento.temaId || '';
    }

    btnEliminarEvento.style.display = esPropietario ? 'inline-flex' : 'none';
  } else {
    formEvento.reset();
    checkTodoElDia.checked = true;
    ajustarInputsFechaSegunTodoElDia(true);

    const ahora = fechaPorDefecto ? new Date(fechaPorDefecto) : new Date();
    inputInicio.value = aValorInputFecha(ahora.toISOString(), true);
    inputFin.value = aValorInputFecha(ahora.toISOString(), true);

    checkRecDia.checked = true;
    checkRecHora.checked = true;
    if (esDocenteOAdmin) {
      selectGrupo.value = 'todos';
    }
    btnEliminarEvento.style.display = 'none';
  }

  modalEvento.showModal();
}

function ajustarInputsFechaSegunTodoElDia(esTodoElDia) {
  if (esTodoElDia) {
    inputInicio.type = 'date';
    inputFin.type = 'date';
  } else {
    inputInicio.type = 'datetime-local';
    inputFin.type = 'datetime-local';
  }
}

checkTodoElDia.addEventListener('change', () => {
  const valInicio = inputInicio.value;
  const valFin = inputFin.value;
  ajustarInputsFechaSegunTodoElDia(checkTodoElDia.checked);
  if (valInicio) inputInicio.value = valInicio.slice(0, 10);
  if (valFin) inputFin.value = valFin.slice(0, 10);
});

btnCancelarModal.addEventListener('click', () => {
  modalEvento.close();
});

btnNuevoEvento.addEventListener('click', () => {
  abrirModal();
});

/**
 * Renderiza la sección superior dinámica de Próximos Eventos.
 * Cumple con el requisito: muestra obligatoriamente todos los eventos futuros (Navidad, festividades, tareas).
 */
function renderizarProximosEventos() {
  const ahora = new Date();
  const hoyMediaNoche = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0);
  const finSieteDias = new Date(hoyMediaNoche.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59);

  let filtrados = eventos.filter(ev => {
    const fInicio = new Date(ev.inicio);
    const fFin = ev.fin ? new Date(ev.fin) : fInicio;
    const esVencido = fFin < ahora;
    const esFuturo = fFin >= hoyMediaNoche;

    if (filtroActual === 'todos') {
      return esFuturo || (esVencido && !ev.completado);
    }
    if (filtroActual === 'semana') {
      return (fInicio >= hoyMediaNoche && fInicio <= finSieteDias) || (esVencido && !ev.completado);
    }
    if (filtroActual === 'mes') {
      return (fInicio >= hoyMediaNoche && fInicio <= finMes) || (esVencido && !ev.completado);
    }
    if (filtroActual === 'festividades') {
      return ev.tipo === 'festividad';
    }
    if (filtroActual === 'fechas-limite') {
      return ev.tipo === 'fecha-limite' || ev.tipo === 'tarea';
    }
    return true;
  });

  // Ordenar cronológicamente: vencidos primero si no están cumplidos, luego por fecha de inicio
  filtrados.sort((a, b) => {
    const aVenc = (a.fin ? new Date(a.fin) : new Date(a.inicio)) < ahora && !a.completado;
    const bVenc = (b.fin ? new Date(b.fin) : new Date(b.inicio)) < ahora && !b.completado;
    if (aVenc && !bVenc) return -1;
    if (!aVenc && bVenc) return 1;
    return new Date(a.inicio) - new Date(b.inicio);
  });

  if (filtrados.length === 0) {
    listaProximos.innerHTML = `
      <div class="alerta alerta--info" style="grid-column: 1 / -1;">
        No hay eventos registrados bajo el filtro seleccionado.
      </div>
    `;
    return;
  }

  listaProximos.innerHTML = filtrados.map(ev => {
    const fInicio = new Date(ev.inicio);
    const fFin = ev.fin ? new Date(ev.fin) : fInicio;
    const esVencido = fFin < ahora && !ev.completado;
    const cumplido = ev.completado;

    const diaNum = String(fInicio.getUTCDate()).padStart(2, '0');
    const mesAbr = MESES_ABR[fInicio.getUTCMonth()];
    const anio = fInicio.getUTCFullYear();

    const configTipo = COLORES_POR_TIPO[ev.tipo] || COLORES_POR_TIPO.recordatorio;
    const textoCuenta = calcularTextoCuenta(ev.inicio, ev.todoElDia);

    const alcanceTexto = ev.esInstitucional || !ev.grupoId || ev.grupoId === 'todos'
      ? '🏛️ Institucional (Todos)'
      : `Paralelo ${ev.grupoId}`;

    const claseCard = [
      'evento-card',
      `evento-card--${ev.tipo || 'recordatorio'}`,
      esVencido ? 'evento-card--vencido' : ''
    ].filter(Boolean).join(' ');

    const tituloMostrar = cumplido ? `✓ ${ev.titulo}` : ev.titulo;

    return `
      <article class="${claseCard}" data-id="${ui.escapar(ev.id)}" tabindex="0" role="listitem">
        <div class="evento-card__fecha-col">
          <span class="evento-card__dia">${diaNum}</span>
          <span class="evento-card__mes">${mesAbr}</span>
          <span style="font-size: 0.65rem; color: var(--texto-suave);">${anio}</span>
        </div>
        <div class="evento-card__cuerpo">
          <div class="evento-card__encabezado">
            <h3 class="evento-card__titulo">${ui.escapar(tituloMostrar)}</h3>
          </div>
          <div class="evento-card__cuenta">${ui.escapar(textoCuenta)}</div>
          <div class="evento-card__meta">
            <span class="etiqueta" style="background-color: ${configTipo.fondo}; color: ${configTipo.texto};">${configTipo.etiqueta}</span>
            <span class="etiqueta etiqueta--info">${ui.escapar(alcanceTexto)}</span>
            ${cumplido ? '<span class="etiqueta etiqueta--exito">✓ Completado</span>' : ''}
          </div>
        </div>
      </article>
    `;
  }).join('');

  listaProximos.querySelectorAll('.evento-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      const ev = eventos.find(e => e.id === id);
      if (ev) abrirModal(ev);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });
}

/**
 * Prepara y renderiza el calendario FullCalendar
 */
function renderizarCalendario() {
  const eventosCalendario = eventos.map(ev => {
    const cumplido = ev.completado;
    const colorObj = COLORES_POR_TIPO[ev.tipo] || COLORES_POR_TIPO.recordatorio;
    const tituloConCheck = cumplido ? `✓ ${ev.titulo}` : ev.titulo;

    let finCalendario = ev.fin || ev.inicio;
    if (ev.todoElDia && ev.fin) {
      const finInclusivo = new Date(ev.fin);
      finInclusivo.setUTCDate(finInclusivo.getUTCDate() + 1);
      finCalendario = finInclusivo.toISOString();
    }

    return {
      id: ev.id,
      title: tituloConCheck,
      start: ev.inicio,
      end: finCalendario,
      allDay: Boolean(ev.todoElDia),
      backgroundColor: colorObj.fondo,
      borderColor: colorObj.borde,
      textColor: colorObj.texto,
      extendedProps: { ...ev }
    };
  });

  const calendarEl = document.getElementById('calendario');

  if (calendarioInstancia) {
    calendarioInstancia.removeAllEvents();
    calendarioInstancia.addEventSource(eventosCalendario);
    return;
  }

  if (!window.FullCalendar) {
    calendarEl.innerHTML = '<div class="alerta alerta--error">No se pudo cargar la librería FullCalendar.</div>';
    return;
  }

  calendarioInstancia = new window.FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'es',
    firstDay: 1, // Lunes primer día
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,listWeek'
    },
    buttonText: {
      today: 'Hoy',
      month: 'Mes',
      week: 'Semana',
      list: 'Lista'
    },
    navLinks: true,
    editable: false,
    selectable: true,
    dayMaxEvents: true,
    events: eventosCalendario,
    eventClick: function(info) {
      const ev = eventos.find(e => e.id === info.event.id);
      if (ev) abrirModal(ev);
    },
    dateClick: function(info) {
      abrirModal(null, info.dateStr);
    }
  });

  calendarioInstancia.render();
}

/**
 * Carga todos los datos necesarios y procesa el estado de cumplimiento.
 */
async function cargarDatos() {
  try {
    ui.cargando(true);

    const peticiones = [
      api.listar('agenda'),
      api.listar('intentos')
    ];

    if (esDocenteOAdmin) {
      peticiones.push(api.listar('distributivo'));
      peticiones.push(api.listar('temas'));
    }

    const [listaAgenda, listaIntentos, listaDistributivo, listaTemas] = await Promise.all(peticiones);

    intentos = listaIntentos || [];

    if (esDocenteOAdmin) {
      gruposDocente = (listaDistributivo || []).filter(g => usuario.rol === 'admin' || esDocenteDeGrupo(g, usuario.id));
      temas = listaTemas || [];

      // Poblar select de grupos con opción para todos destacada
      selectGrupo.innerHTML = `
        <option value="todos" selected>Para todos (Institucional / Toda la comunidad)</option>
        <option value="">Personal (solo para mí)</option>
      `;
      gruposDocente.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = `Paralelo ${g.paralelo || g.id} (${g.periodo || 'Periodo'})`;
        selectGrupo.appendChild(opt);
      });

      // Poblar select de temas
      selectTema.innerHTML = '<option value="">Ninguno</option>';
      temas.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.titulo;
        selectTema.appendChild(opt);
      });
    }

    // Procesar eventos y verificar cumplimiento
    eventos = (listaAgenda || []).map(ev => {
      ev.completado = estaCumplido(ev);
      return ev;
    });

    renderizarProximosEventos();
    renderizarCalendario();
  } catch (err) {
    ui.aviso(err.message || 'Error al cargar la agenda', 'error');
  } finally {
    ui.cargando(false);
  }
}

/**
 * Guardar o actualizar un evento.
 */
formEvento.addEventListener('submit', async (e) => {
  e.preventDefault();

  const titulo = inputTitulo.value.trim();
  const tipo = selectTipo.value;
  const todoElDia = checkTodoElDia.checked;
  const inicio = inputInicio.value;
  const fin = inputFin.value || null;

  if (!titulo || !inicio) {
    ui.aviso('Por favor completa los campos obligatorios (*)', 'error');
    return;
  }

  const recordatorios = [];
  if (checkRecDia.checked) recordatorios.push(1440);
  if (checkRecHora.checked) recordatorios.push(60);

  const datosEvento = {
    titulo,
    tipo,
    todoElDia,
    inicio: new Date(todoElDia ? `${inicio}T00:00:00.000Z` : inicio).toISOString(),
    fin: fin ? new Date(todoElDia ? `${fin}T00:00:00.000Z` : fin).toISOString() : null,
    recordatorios
  };

  if (esDocenteOAdmin) {
    const valGrupo = selectGrupo.value;
    if (valGrupo === 'todos') {
      datosEvento.esInstitucional = true;
      datosEvento.grupoId = 'todos';
    } else {
      datosEvento.esInstitucional = false;
      datosEvento.grupoId = valGrupo || null;
    }
    datosEvento.actividad = selectActividad.value || null;
    datosEvento.temaId = selectTema.value || null;
  } else {
    datosEvento.esInstitucional = false;
    datosEvento.grupoId = null;
  }

  try {
    ui.cargando(true);
    if (eventoEditandoId) {
      await api.actualizar('agenda', eventoEditandoId, datosEvento);
      ui.aviso('Evento actualizado con éxito', 'exito');
    } else {
      await api.crear('agenda', datosEvento);
      ui.aviso('Evento creado y notificado con éxito a la comunidad', 'exito');
    }
    modalEvento.close();
    await cargarDatos();
  } catch (err) {
    ui.aviso(err.message || 'Error al guardar el evento', 'error');
  } finally {
    ui.cargando(false);
  }
});

/**
 * Eliminar evento
 */
btnEliminarEvento.addEventListener('click', async () => {
  if (!eventoEditandoId) return;

  const confirmar = await ui.confirmar('¿Estás seguro de que deseas eliminar este evento?');
  if (!confirmar) return;

  try {
    ui.cargando(true);
    await api.llamar('DELETE', `/api/agenda/${eventoEditandoId}`);
    ui.aviso('Evento eliminado con éxito', 'exito');
    modalEvento.close();
    await cargarDatos();
  } catch (err) {
    ui.aviso(err.message || 'Error al eliminar el evento', 'error');
  } finally {
    ui.cargando(false);
  }
});

await cargarDatos();
