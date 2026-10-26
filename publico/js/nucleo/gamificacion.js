// publico/js/nucleo/gamificacion.js · Gestión de intentos, logros y recompensas en navegador
import { llamar } from './api.js';
import { aviso, modal, escapar } from './ui.js';

/**
 * Registra un intento de actividad en el servidor y procesa logros obtenidos
 * @param {Object} datos
 * @returns {Promise<Object>} Resultado del intento
 */
export async function registrarIntento(datos) {
  const resultado = await llamar('POST', '/api/intentos', datos);
  await mostrarLogros(resultado);
  return resultado;
}

/**
 * Muestra retroalimentación visual de puntos e insignias desbloqueadas
 * @param {Object} resultado
 */
export async function mostrarLogros(resultado) {
  if (!resultado) return;

  // 1. Notificación flotante de puntos ganados si son más de 0
  if (typeof resultado.puntosGanados === 'number' && resultado.puntosGanados > 0) {
    aviso(`+${resultado.puntosGanados} puntos ganados`, 'exito');
  }

  // 2. Actualizar el indicador de puntos en el encabezado si existe
  if (resultado.puntosTotales !== undefined) {
    const elPuntos = document.getElementById('puntos-usuario');
    if (elPuntos) {
      const cant = elPuntos.querySelector('.puntos-usuario__cantidad');
      if (cant) {
        cant.textContent = resultado.puntosTotales;
      } else {
        elPuntos.textContent = `${resultado.puntosTotales} pts`;
      }
    }
  }

  // 3. Modal de celebración por cada insignia nueva desbloqueada
  if (Array.isArray(resultado.insigniasNuevas) && resultado.insigniasNuevas.length > 0) {
    for (const ins of resultado.insigniasNuevas) {
      const icono = ins.icono || '🏆';
      const nombre = ins.nombre || 'Insignia';
      const descripcion = ins.descripcion || '¡Has desbloqueado una nueva insignia!';

      const elCelebracion = document.createElement('div');
      elCelebracion.className = 'celebracion';
      elCelebracion.innerHTML = `
        <div class="celebracion__icono" aria-hidden="true">${escapar(icono)}</div>
        <h3 class="celebracion__nombre">${escapar(nombre)}</h3>
        <p class="celebracion__texto">${escapar(descripcion)}</p>
      `;

      await modal({
        titulo: '¡Nueva Insignia Desbloqueada!',
        contenido: elCelebracion,
        acciones: [{ texto: '¡Continuar!', valor: true, clase: 'btn--primario' }]
      });
    }
  }
}

/**
 * Consulta los logros acumulados de un usuario
 * @param {string} [usuarioId="yo"]
 * @returns {Promise<{ puntos: number, insignias: Array, nivelQuiz: Object }>}
 */
export async function logrosDe(usuarioId = 'yo') {
  return llamar('GET', `/api/logros/${encodeURIComponent(usuarioId)}`);
}

export default {
  registrarIntento,
  mostrarLogros,
  logrosDe
};
