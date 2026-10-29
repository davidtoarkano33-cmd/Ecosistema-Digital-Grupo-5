// servidor/ganchos/alertas.js · Reglas de acceso y validación para la colección alertas
import * as almacen from '../almacen.js';
import { esDocenteDeGrupo } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!usuario || !Array.isArray(lista)) return [];
  if (usuario.rol === 'admin') return lista;

  if (usuario.rol === 'docente') {
    const distributivo = await almacen.leer('distributivo');
    const misGrupos = (distributivo || []).filter(g => g && esDocenteDeGrupo(g, usuario.id));
    const misGruposIds = new Set(misGrupos.map(g => String(g.id)));

    return lista.filter(a => a && misGruposIds.has(String(a.grupoId)));
  }

  return [];
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    const err = new Error('Sesión requerida');
    err.estado = 401;
    throw err;
  }

  // Modificación / Actualización (PUT /api/alertas/:id)
  if (anterior) {
    if (usuario.rol !== 'admin' && usuario.rol !== 'docente') {
      const err = new Error('No tienes permiso para modificar alertas');
      err.estado = 403;
      throw err;
    }

    if (usuario.rol === 'docente') {
      const distributivo = await almacen.leer('distributivo');
      const esDocenteDelGrupo = (distributivo || []).some(g =>
        g && String(g.id) === String(anterior.grupoId) && esDocenteDeGrupo(g, usuario.id)
      );

      if (!esDocenteDelGrupo) {
        const err = new Error('Solo puedes gestionar alertas de tus grupos asignados');
        err.estado = 403;
        throw err;
      }
    }

    // Regla estricta: solo permite cambiar el campo estado
    const camposPermitidos = ['estado'];
    const datosNuevos = {};

    for (const [clave, valor] of Object.entries(datos || {})) {
      if (camposPermitidos.includes(clave)) {
        datosNuevos[clave] = valor;
      }
    }

    if (datosNuevos.estado && !['activa', 'atendida'].includes(datosNuevos.estado)) {
      const err = new Error('El estado debe ser "activa" o "atendida"');
      err.estado = 400;
      throw err;
    }

    return datosNuevos;
  }

  // Creación vía API genérica directa: solo admin (el servidor las crea mediante evaluarAlertas)
  if (usuario.rol !== 'admin') {
    const err = new Error('Solo el sistema de evaluación o el administrador pueden generar alertas');
    err.estado = 403;
    throw err;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
