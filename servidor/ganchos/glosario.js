// servidor/ganchos/glosario.js · Reglas de acceso y validación para glosario
import * as almacen from '../almacen.js';
import { asignaturasDe, asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];

  if (usuario.rol === 'admin') {
    return lista;
  }

  const temas = await almacen.leer('temas');
  const unidades = await almacen.leer('unidades');

  const mapaUnidadAsignatura = new Map(unidades.map(u => [u.id, u.asignaturaId]));
  const mapaUnidadVisible = new Map(unidades.map(u => [u.id, u.visible]));
  const mapaTemaUnidad = new Map(temas.map(t => [t.id, t.unidadId]));
  const mapaTemaEstado = new Map(temas.map(t => [t.id, t.estado]));

  const misAsignaturas = await asignaturasDe(usuario);
  const misAsigIds = new Set(misAsignaturas.map(a => a.id));

  return lista.filter(item => {
    const unidadId = mapaTemaUnidad.get(item.temaId);
    const asignaturaId = unidadId ? mapaUnidadAsignatura.get(unidadId) : null;
    const perteneceAsignatura = asignaturaId && misAsigIds.has(asignaturaId);

    if (usuario.rol === 'docente' && perteneceAsignatura) {
      return true;
    }

    // Las sesiones pueden consultar el glosario aprobado de contenido publicado.
    if (!unidadId || mapaUnidadVisible.get(unidadId) === false) {
      return false;
    }
    return mapaTemaEstado.get(item.temaId) === 'publicado' && item.estado === 'aprobado';
  });
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    const error = new Error('Sesión requerida');
    error.estado = 401;
    throw error;
  }

  const temaId = (datos && datos.temaId) || (anterior && anterior.temaId);
  if (!temaId) {
    const error = new Error('El tema es requerido para el término de glosario');
    error.estado = 400;
    throw error;
  }

  const asignaturaId = await asignaturaDeTema(temaId);
  if (!asignaturaId) {
    const error = new Error('No se pudo resolver la asignatura del tema');
    error.estado = 404;
    throw error;
  }

  const puede = await puedeEditarAsignatura(usuario, asignaturaId);
  if (!puede) {
    const error = new Error('No tienes permisos para editar términos de glosario en esta asignatura');
    error.estado = 403;
    throw error;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
