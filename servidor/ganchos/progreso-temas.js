// servidor/ganchos/progreso-temas.js · Reglas de acceso y validación para progreso-temas
import * as almacen from '../almacen.js';
import { estudiantesDe } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];

  if (usuario.rol === 'admin') {
    return lista;
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter(item => item && String(item.usuarioId) === String(usuario.id));
  }

  if (usuario.rol === 'docente') {
    const misEstudiantes = await estudiantesDe(usuario.id);
    const misEstIds = new Set(misEstudiantes.map(e => String(e.id)));
    return lista.filter(item => item && misEstIds.has(String(item.usuarioId)));
  }

  return [];
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    const error = new Error('Sesión requerida');
    error.estado = 401;
    throw error;
  }

  if (usuario.rol !== 'estudiante') {
    const error = new Error('Solo los estudiantes pueden registrar progreso de temas');
    error.estado = 403;
    throw error;
  }

  // Fija usuarioId = usuario.id
  datos.usuarioId = usuario.id;

  if (!datos.temaId) {
    const error = new Error('El temaId es obligatorio');
    error.estado = 400;
    throw error;
  }

  // Rechazar duplicados (usuarioId + temaId)
  const existentes = await almacen.buscar('progreso-temas', {
    usuarioId: datos.usuarioId,
    temaId: datos.temaId
  });

  const idActual = anterior ? anterior.id : (datos ? datos.id : null);
  const duplicado = existentes.some(reg => !idActual || reg.id !== idActual);

  if (duplicado) {
    const error = new Error('El progreso de este tema ya fue registrado previamente');
    error.estado = 400;
    throw error;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
