// servidor/ganchos/canciones.js · Reglas de acceso y validación para canciones educativas
import * as almacen from '../almacen.js';
import { asignaturasDe, asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];

  // Admin tiene acceso a todas las canciones
  if (usuario.rol === 'admin') {
    return lista;
  }

  // Obtener las asignaturas a las que pertenece el usuario
  const misAsignaturas = await asignaturasDe(usuario);
  const misAsigIds = new Set(misAsignaturas.map(a => a.id));

  // Mapa de temaId -> asignaturaId
  const temas = await almacen.leer('temas');
  const unidades = await almacen.leer('unidades');
  const mapaUnidadAsignatura = new Map(unidades.map(u => [u.id, u.asignaturaId]));
  const mapaTemaAsignatura = new Map(temas.map(t => [t.id, mapaUnidadAsignatura.get(t.unidadId)]));

  return lista.filter(cancion => {
    if (!cancion || !cancion.temaId) return false;
    const asigId = mapaTemaAsignatura.get(cancion.temaId);
    return asigId && misAsigIds.has(asigId);
  });
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    const error = new Error('Sesión requerida');
    error.estado = 401;
    throw error;
  }

  if (usuario.rol !== 'docente' && usuario.rol !== 'admin') {
    const error = new Error('No tienes permisos para crear o editar canciones');
    error.estado = 403;
    throw error;
  }

  const temaId = (datos && datos.temaId) || (anterior && anterior.temaId);
  if (!temaId) {
    const error = new Error('El tema relacionado es obligatorio');
    error.estado = 400;
    throw error;
  }

  const asignaturaId = await asignaturaDeTema(temaId);
  if (!asignaturaId) {
    const error = new Error('No se pudo determinar la asignatura del tema');
    error.estado = 400;
    throw error;
  }

  const permitido = await puedeEditarAsignatura(usuario, asignaturaId);
  if (!permitido) {
    const error = new Error('No tienes permiso para editar canciones en esta asignatura');
    error.estado = 403;
    throw error;
  }

  // Validaciones obligatorias según contrato: titulo, audio, letra, autoria, licencia
  if (!datos.titulo || typeof datos.titulo !== 'string' || !datos.titulo.trim()) {
    const error = new Error('El título de la canción es obligatorio');
    error.estado = 400;
    throw error;
  }

  if (!datos.audio || typeof datos.audio !== 'string' || !datos.audio.trim()) {
    const error = new Error('El archivo de audio es obligatorio');
    error.estado = 400;
    throw error;
  }

  if (!datos.letra || typeof datos.letra !== 'string' || !datos.letra.trim()) {
    const error = new Error('La letra de la canción es obligatoria');
    error.estado = 400;
    throw error;
  }

  if (!datos.autoria || typeof datos.autoria !== 'string' || !datos.autoria.trim()) {
    const error = new Error('La autoría es obligatoria');
    error.estado = 400;
    throw error;
  }

  if (!datos.licencia || typeof datos.licencia !== 'string' || !datos.licencia.trim()) {
    const error = new Error('La licencia es obligatoria');
    error.estado = 400;
    throw error;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
