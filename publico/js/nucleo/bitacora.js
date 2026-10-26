// publico/js/nucleo/bitacora.js · Registro de eventos en la bitácora
import { llamar } from './api.js';

export async function registrarEvento(tipo, recurso) {
  try {
    return await llamar('POST', '/api/eventos', { tipo, recurso });
  } catch (err) {
    // Si falla el registro en segundo plano, no se bloquea la interfaz
    console.warn('No se pudo registrar el evento en bitácora:', err.message);
    return null;
  }
}

export default {
  registrarEvento
};
