// servidor/ganchos/intentos.js · Reglas de acceso para intentos
import { estudiantesDe } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!usuario || !Array.isArray(lista)) return [];
  if (usuario.rol === 'admin') return lista;

  if (usuario.rol === 'estudiante') {
    return lista.filter(i => i && String(i.usuarioId) === String(usuario.id));
  }

  if (usuario.rol === 'docente') {
    const estudiantes = await estudiantesDe(usuario.id);
    const ids = new Set(estudiantes.map(e => String(e.id)));
    return lista.filter(i => i && ids.has(String(i.usuarioId)));
  }

  return [];
}

export function antesDeGuardar() {
  const err = new Error('Solo el servidor puede registrar intentos');
  err.estado = 403;
  throw err;
}

export default {
  filtrarLista,
  antesDeGuardar
};
