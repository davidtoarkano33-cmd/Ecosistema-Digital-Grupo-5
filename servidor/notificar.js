// servidor/notificar.js · Emisión y registro de notificaciones en el sistema
import * as almacen from './almacen.js';

/**
 * Registra una notificación para un usuario con estado no leída.
 * @param {string} usuarioId ID del destinatario
 * @param {object} opciones { tipo, mensaje, enlace }
 * @returns {Promise<object>} Registro creado en la colección notificaciones
 */
export async function notificar(usuarioId, { tipo = 'sistema', mensaje = '', enlace = '' } = {}) {
  if (!usuarioId) {
    throw new Error('usuarioId requerido para emitir notificación');
  }

  const registro = {
    usuarioId: String(usuarioId),
    tipo: tipo || 'sistema',
    mensaje: String(mensaje || ''),
    enlace: enlace ? String(enlace) : '',
    leida: false
  };

  return await almacen.agregar('notificaciones', registro);
}

export default {
  notificar
};
