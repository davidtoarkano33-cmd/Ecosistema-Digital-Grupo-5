// servidor/acceso.js · Control y resolución de acceso por grupos y asignaturas
import * as almacen from './almacen.js';

export async function gruposDe(usuario) {
  if (!usuario) return [];
  if (usuario.rol === 'admin') {
    return await almacen.leer('distributivo');
  }

  const distributivo = await almacen.leer('distributivo');
  if (usuario.rol === 'docente') {
    return distributivo.filter(g => g && String(g.docenteId) === String(usuario.id));
  }

  if (usuario.rol === 'estudiante') {
    return distributivo.filter(g => g && Array.isArray(g.estudiantes) && g.estudiantes.some(estId => String(estId) === String(usuario.id)));
  }

  return [];
}

export async function asignaturasDe(usuario) {
  if (!usuario) return [];
  if (usuario.rol === 'admin') {
    return await almacen.leer('asignaturas');
  }

  const grupos = await gruposDe(usuario);
  const asignaturasIds = new Set(grupos.map(g => g.asignaturaId).filter(Boolean));
  const asignaturas = await almacen.leer('asignaturas');
  return asignaturas.filter(a => a && asignaturasIds.has(a.id));
}

export async function asignaturaDeTema(temaId) {
  if (!temaId) return null;
  const temas = await almacen.buscar('temas', { id: temaId });
  const tema = temas[0];
  if (!tema || !tema.unidadId) return null;

  const unidades = await almacen.buscar('unidades', { id: tema.unidadId });
  const unidad = unidades[0];
  if (!unidad || !unidad.asignaturaId) return null;

  return unidad.asignaturaId;
}

export async function puedeEditarAsignatura(usuario, asignaturaId) {
  if (!usuario || !asignaturaId) return false;
  if (usuario.rol === 'admin') return true;
  if (usuario.rol !== 'docente') return false;

  const distributivo = await almacen.leer('distributivo');
  return distributivo.some(g => g && g.asignaturaId === asignaturaId && String(g.docenteId) === String(usuario.id));
}

export async function estudiantesDe(docenteId) {
  if (!docenteId) return [];
  const distributivo = await almacen.leer('distributivo');
  const estudiantesIds = new Set();
  distributivo
    .filter(g => g && String(g.docenteId) === String(docenteId) && Array.isArray(g.estudiantes))
    .forEach(g => g.estudiantes.forEach(estId => estudiantesIds.add(estId)));

  const usuarios = await almacen.leer('usuarios');
  return usuarios.filter(u => u && estudiantesIds.has(u.id));
}

export async function docentesDe(estudianteId) {
  if (!estudianteId) return [];
  const distributivo = await almacen.leer('distributivo');
  const docentesIds = new Set();
  distributivo
    .filter(g => g && Array.isArray(g.estudiantes) && g.estudiantes.some(estId => String(estId) === String(estudianteId)))
    .forEach(g => {
      if (g.docenteId) docentesIds.add(g.docenteId);
    });

  const usuarios = await almacen.leer('usuarios');
  return usuarios.filter(u => u && docentesIds.has(u.id));
}

export default {
  gruposDe,
  asignaturasDe,
  asignaturaDeTema,
  puedeEditarAsignatura,
  estudiantesDe,
  docentesDe
};
