// servidor/ganchos/temas.js · Reglas de acceso y validación para temas
import * as almacen from '../almacen.js';
import { asignaturasDe, puedeEditarAsignatura } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];

  if (usuario.rol === 'admin') {
    return lista;
  }

  // Mapear unidadId -> asignaturaId
  const unidades = await almacen.leer('unidades');
  const mapaUnidadAsignatura = new Map(unidades.map(u => [u.id, u.asignaturaId]));
  const mapaUnidadVisible = new Map(unidades.map(u => [u.id, u.visible]));

  const misAsignaturas = await asignaturasDe(usuario);
  const misAsigIds = new Set(misAsignaturas.map(a => a.id));

  return lista.filter(tema => {
    const asignaturaId = mapaUnidadAsignatura.get(tema.unidadId);
    if (!asignaturaId || !misAsigIds.has(asignaturaId)) {
      return false;
    }

    if (usuario.rol === 'estudiante') {
      // Estudiante tampoco ve temas de unidades no visibles
      if (mapaUnidadVisible.get(tema.unidadId) === false) {
        return false;
      }
      // Estudiante solo ve temas que estén "publicado"
      if (tema.estado !== 'publicado') {
        return false;
      }
    }

    return true;
  });
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    const error = new Error('Sesión requerida');
    error.estado = 401;
    throw error;
  }

  const unidadId = (datos && datos.unidadId) || (anterior && anterior.unidadId);
  if (!unidadId) {
    const error = new Error('La unidad es requerida para el tema');
    error.estado = 400;
    throw error;
  }

  const unidades = await almacen.buscar('unidades', { id: unidadId });
  const unidad = unidades[0];
  if (!unidad) {
    const error = new Error('Unidad no encontrada');
    error.estado = 404;
    throw error;
  }

  const puede = await puedeEditarAsignatura(usuario, unidad.asignaturaId);
  if (!puede) {
    const error = new Error('No tienes permisos para editar temas en esta asignatura');
    error.estado = 403;
    throw error;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
