// servidor/ganchos/unidades.js · Reglas de acceso y validación para unidades
import { asignaturasDe, puedeEditarAsignatura } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];

  // Admin ve todas
  if (usuario.rol === 'admin') {
    return lista;
  }

  // Asignaturas a las que pertenece el usuario
  const misAsignaturas = await asignaturasDe(usuario);
  const misAsigIds = new Set(misAsignaturas.map(a => a.id));

  return lista.filter(unidad => {
    if (!misAsigIds.has(unidad.asignaturaId)) {
      return false;
    }
    // El estudiante no ve unidades con visible === false
    if (usuario.rol === 'estudiante' && unidad.visible === false) {
      return false;
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

  const asignaturaId = (datos && datos.asignaturaId) || (anterior && anterior.asignaturaId);
  const puede = await puedeEditarAsignatura(usuario, asignaturaId);
  if (!puede) {
    const error = new Error('No tienes permisos para editar unidades en esta asignatura');
    error.estado = 403;
    throw error;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
