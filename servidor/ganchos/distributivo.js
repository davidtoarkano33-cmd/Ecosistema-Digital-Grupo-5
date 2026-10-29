// servidor/ganchos/distributivo.js · Reglas de acceso para distributivo
import { gruposDe } from '../acceso.js';
import * as almacen from '../almacen.js';

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const misGrupos = await gruposDe(usuario);
  const misIds = new Set(misGrupos.map(g => g.id));
  return lista.filter(item => misIds.has(item.id));
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario || usuario.rol !== 'admin') {
    const error = new Error('Solo el administrador puede modificar el distributivo');
    error.estado = 403;
    throw error;
  }

  const idsRecibidos = Array.isArray(datos?.docentesIds)
    ? datos.docentesIds
    : [datos?.docenteId || anterior?.docenteId, ...(anterior?.docentesIds || [])];
  const docentesIds = [...new Set(idsRecibidos.filter(Boolean).map(String))];
  if (!docentesIds.length) {
    const error = new Error('Selecciona al menos un docente para el grupo');
    error.estado = 400;
    throw error;
  }

  const usuarios = await almacen.leer('usuarios');
  const docentesValidos = new Set((usuarios || [])
    .filter(item => item && item.rol === 'docente' && item.activo !== false)
    .map(item => String(item.id)));
  if (docentesIds.some(id => !docentesValidos.has(id))) {
    const error = new Error('Uno o más docentes seleccionados no son válidos o están inactivos');
    error.estado = 400;
    throw error;
  }

  return {
    ...datos,
    docenteId: docentesIds[0],
    docentesIds
  };
}

export default {
  filtrarLista,
  antesDeGuardar
};
