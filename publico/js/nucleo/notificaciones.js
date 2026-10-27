// publico/js/nucleo/notificaciones.js · Botón campana, contador y panel desplegable de notificaciones
import { llamar } from './api.js';
import { escapar, aviso } from './ui.js';
import { fechaRelativa } from './util.js';

let intervaloConsulta = null;
let panelAbierto = false;

/**
 * Consulta la cantidad de notificaciones sin leer.
 * @returns {Promise<number>}
 */
export async function noLeidas() {
  try {
    const res = await llamar('GET', '/api/notificaciones');
    return typeof res.totalSinLeer === 'number' ? res.totalSinLeer : 0;
  } catch {
    return 0;
  }
}

/**
 * Monta el componente de campana en el encabezado con contador y panel desplegable.
 */
export async function montarCampana() {
  const contenedorCampana = document.getElementById('contenedor-campana');
  if (!contenedorCampana) return;

  contenedorCampana.innerHTML = `
    <div class="campana-contenedor" style="position: relative;">
      <button type="button"
              id="btn-campana"
              class="btn-campana"
              aria-label="Notificaciones (0 sin leer)"
              aria-haspopup="true"
              aria-expanded="false"
              title="Notificaciones">
        <span class="btn-campana__icono" aria-hidden="true">🔔</span>
        <span id="badge-campana" class="btn-campana__badge btn-campana__badge--cero">0</span>
      </button>

      <!-- Panel desplegable -->
      <div id="panel-notificaciones"
           class="panel-notificaciones"
           role="region"
           aria-label="Panel de notificaciones"
           hidden>
        <header class="panel-notificaciones__cabecera">
          <strong class="panel-notificaciones__titulo">Notificaciones</strong>
        </header>

        <div id="lista-notificaciones" class="panel-notificaciones__lista" role="feed" aria-busy="false">
          <div class="panel-notificaciones__cargando" style="padding: var(--espacio-m); text-align: center; color: var(--texto-suave);">
            Cargando notificaciones...
          </div>
        </div>

        <footer class="panel-notificaciones__pie">
          <button type="button" id="btn-activar-avisos" class="btn btn--secundario btn--pequeno">
            Activar avisos del navegador
          </button>
          <button type="button" id="btn-marcar-todas-leidas" class="btn btn--secundario btn--pequeno" style="width: 100%; font-size: var(--tamano-xs);">
            ✓ Marcar todas como leídas
          </button>
        </footer>
      </div>
    </div>
  `;

  const btnCampana = document.getElementById('btn-campana');
  const panel = document.getElementById('panel-notificaciones');
  const badge = document.getElementById('badge-campana');
  const btnActivarAvisos = document.getElementById('btn-activar-avisos');
  const btnMarcarTodas = document.getElementById('btn-marcar-todas-leidas');
  const lista = document.getElementById('lista-notificaciones');

  function actualizarBotonAvisos() {
    if (!btnActivarAvisos) return;
    btnActivarAvisos.hidden = !('Notification' in window) || Notification.permission === 'granted';
    if ('Notification' in window && Notification.permission === 'denied') {
      btnActivarAvisos.textContent = 'Avisos bloqueados en el navegador';
      btnActivarAvisos.disabled = true;
    }
  }

  async function consultarRecordatorios() {
    try {
      const res = await llamar('GET', '/api/agenda/recordatorios');
      const recordatorios = Array.isArray(res.recordatorios) ? res.recordatorios : [];
      if (!('Notification' in window) || Notification.permission !== 'granted') return;

      recordatorios.forEach(recordatorio => {
        const avisoNativo = new Notification(recordatorio.titulo || 'Recordatorio de agenda', {
          body: recordatorio.mensaje || 'Tienes un evento pendiente.'
        });
        avisoNativo.addEventListener('click', () => {
          window.focus();
          window.location.href = recordatorio.enlace || '/paginas/agenda.html';
          avisoNativo.close();
        });
      });
    } catch {
      // Ignorar errores en segundo plano
    }
  }

  async function actualizarContador() {
    // Solo consultar si la pestaña está visible
    if (document.hidden) return;

    try {
      const res = await llamar('GET', '/api/notificaciones');
      const cant = res.totalSinLeer || 0;

      if (btnCampana) {
        btnCampana.setAttribute('aria-label', `Notificaciones (${cant} sin leer)`);
      }

      if (badge) {
        badge.style.display = 'inline-flex';
        if (cant > 0) {
          badge.textContent = cant > 99 ? '99+' : cant;
          badge.classList.remove('btn-campana__badge--cero');
        } else {
          badge.textContent = '0';
          badge.classList.add('btn-campana__badge--cero');
        }
      }

      // Si el panel está abierto, refrescar contenido
      if (panelAbierto) {
        renderizarNotificaciones(res.notificaciones || []);
      }
    } catch {
      // Ignorar errores en segundo plano
    }
  }

  function renderizarNotificaciones(items) {
    if (!lista) return;

    if (!items || items.length === 0) {
      lista.innerHTML = `
        <div class="panel-notificaciones__vacio" style="padding: var(--espacio-l); text-align: center; color: var(--texto-suave); font-size: var(--tamano-s);">
          <span style="font-size: 1.5rem; display: block; margin-bottom: var(--espacio-xs);">📭</span>
          No tienes notificaciones
        </div>
      `;
      return;
    }

    lista.innerHTML = items.map(n => {
      const claseNoLeida = n.leida ? '' : ' notificacion-item--no-leida';
      const tiempoRelativo = fechaRelativa(n.fecha);
      const enlace = n.enlace ? n.enlace : '#';

      return `
        <article class="notificacion-item${claseNoLeida}" data-id="${escapar(n.id)}" data-enlace="${escapar(enlace)}">
          <div class="notificacion-item__contenido">
            <p class="notificacion-item__mensaje">${escapar(n.mensaje)}</p>
            <span class="notificacion-item__fecha">${escapar(tiempoRelativo)}</span>
          </div>
          ${!n.leida ? '<span class="notificacion-item__punto" aria-hidden="true"></span>' : ''}
        </article>
      `;
    }).join('');

    // Eventos de clic en elementos de la lista
    const elementos = lista.querySelectorAll('.notificacion-item');
    elementos.forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.getAttribute('data-id');
        const urlDestino = el.getAttribute('data-enlace');

        try {
          await llamar('POST', `/api/notificaciones/${id}/leida`);
        } catch {
          // Continuar aunque falle
        }

        if (urlDestino && urlDestino !== '#') {
          window.location.href = urlDestino;
        } else {
          await actualizarContador();
        }
      });
    });
  }

  async function alternarPanel() {
    panelAbierto = !panelAbierto;
    if (panel) {
      panel.hidden = !panelAbierto;
      btnCampana.setAttribute('aria-expanded', panelAbierto ? 'true' : 'false');

      if (panelAbierto) {
        lista.innerHTML = `<div style="padding: var(--espacio-m); text-align: center; color: var(--texto-suave);">Cargando...</div>`;
        try {
          const res = await llamar('GET', '/api/notificaciones');
          renderizarNotificaciones(res.notificaciones || []);
        } catch (err) {
          lista.innerHTML = `<div style="padding: var(--espacio-m); color: var(--error);">Error al cargar notificaciones</div>`;
        }
      }
    }
  }

  if (btnCampana) {
    btnCampana.addEventListener('click', (e) => {
      e.stopPropagation();
      alternarPanel();
    });
  }

  if (btnActivarAvisos) {
    actualizarBotonAvisos();
    btnActivarAvisos.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!('Notification' in window)) {
        aviso('Este navegador no admite avisos del sistema', 'error');
        return;
      }
      const permiso = await Notification.requestPermission();
      actualizarBotonAvisos();
      aviso(
        permiso === 'granted' ? 'Avisos del navegador activados' : 'No se activaron los avisos del navegador',
        permiso === 'granted' ? 'exito' : 'error'
      );
    });
  }

  // Cerrar al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (panelAbierto && contenedorCampana && !contenedorCampana.contains(e.target)) {
      panelAbierto = false;
      if (panel) panel.hidden = true;
      if (btnCampana) btnCampana.setAttribute('aria-expanded', 'false');
    }
  });

  // Marcar todas como leídas
  if (btnMarcarTodas) {
    btnMarcarTodas.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await llamar('POST', '/api/notificaciones/leidas');
        aviso('Notificaciones marcadas como leídas', 'exito');

        // Poner contador y badge a 0 visible inmediatamente
        if (badge) {
          badge.textContent = '0';
          badge.style.display = 'inline-flex';
          badge.classList.add('btn-campana__badge--cero');
        }
        if (btnCampana) {
          btnCampana.setAttribute('aria-label', 'Notificaciones (0 sin leer)');
        }

        // Quitar estilos y puntos de no leídas en la lista visible
        if (lista) {
          lista.querySelectorAll('.notificacion-item--no-leida').forEach(item => {
            item.classList.remove('notificacion-item--no-leida');
          });
          lista.querySelectorAll('.notificacion-item__punto').forEach(punto => {
            punto.remove();
          });
        }

        await actualizarContador();
      } catch (err) {
        aviso('No se pudieron marcar las notificaciones', 'error');
      }
    });
  }

  // Primera consulta inmediata
  await consultarRecordatorios();
  await actualizarContador();

  // Consulta periódica para mostrar pronto las alertas generadas en otras sesiones.
  if (intervaloConsulta) {
    clearInterval(intervaloConsulta);
  }
  intervaloConsulta = setInterval(() => {
    if (!document.hidden) {
      consultarRecordatorios().then(actualizarContador);
    }
  }, 15000);

  // Escuchar cambio de visibilidad de la pestaña
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      consultarRecordatorios().then(actualizarContador);
    }
  });
}

export default {
  montarCampana,
  noLeidas
};
