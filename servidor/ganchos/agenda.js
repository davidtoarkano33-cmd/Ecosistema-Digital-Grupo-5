// servidor/ganchos/agenda.js · Reglas de acceso, filtrado, validación y notificaciones para agenda
import * as almacen from '../almacen.js';
import { docentesIdsDeGrupo, gruposDe } from '../acceso.js';
import { notificar } from '../notificar.js';

const TIPOS_VALIDOS = ['tarea', 'reunion', 'fecha-limite', 'recordatorio', 'festividad'];

/**
 * Filtra los eventos visibles para el usuario:
 * - Institucionales / para todos
 * - Eventos de sus grupos asignados
 * - Eventos propios
 */
export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];

  if (usuario.rol === 'admin') {
    return lista;
  }

  const misGrupos = await gruposDe(usuario);
  const misGruposIds = new Set((misGrupos || []).map(g => String(g.id)));

  return (lista || []).filter(evento => {
    if (!evento) return false;
    const esInstitucional = Boolean(evento.esInstitucional || !evento.grupoId || evento.grupoId === 'todos');
    const esPropio = String(evento.propietarioId) === String(usuario.id);
    const esDeMiGrupo = evento.grupoId && misGruposIds.has(String(evento.grupoId));
    return esInstitucional || esPropio || esDeMiGrupo;
  });
}

/**
 * Valida reglas de negocio antes de guardar un evento en la agenda.
 */
export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    const error = new Error('Sesión requerida');
    error.estado = 401;
    throw error;
  }

  const esDocenteOAdmin = usuario.rol === 'docente' || usuario.rol === 'admin';

  // Creación de un nuevo evento
  if (!anterior) {
    datos.propietarioId = String(usuario.id);

    if (datos.grupoId && datos.grupoId !== 'todos') {
      if (!esDocenteOAdmin) {
        const error = new Error('Solo docentes y administradores pueden asignar eventos a grupos');
        error.estado = 403;
        throw error;
      }

      const misGrupos = await gruposDe(usuario);
      const pertenece = (misGrupos || []).some(g => String(g.id) === String(datos.grupoId));
      if (!pertenece) {
        const error = new Error('No tienes acceso al grupo especificado');
        error.estado = 403;
        throw error;
      }
    }

    // Solo "todos" o la marca explícita convierten el evento en institucional.
    if (esDocenteOAdmin && (datos.esInstitucional === true || datos.grupoId === 'todos')) {
      datos.esInstitucional = true;
      datos.grupoId = 'todos';
    } else if (!datos.grupoId) {
      datos.esInstitucional = false;
      datos.grupoId = null;
    }

    if (!datos.titulo || typeof datos.titulo !== 'string' || !datos.titulo.trim()) {
      const error = new Error('El título del evento es requerido');
      error.estado = 400;
      throw error;
    }

    if (!datos.tipo || !TIPOS_VALIDOS.includes(datos.tipo)) {
      const error = new Error(`Tipo de evento inválido. Debe ser uno de: ${TIPOS_VALIDOS.join(', ')}`);
      error.estado = 400;
      throw error;
    }

    if (!datos.inicio) {
      const error = new Error('La fecha/hora de inicio es requerida');
      error.estado = 400;
      throw error;
    }

    datos.todoElDia = Boolean(datos.todoElDia);
    datos.recordatorios = Array.isArray(datos.recordatorios)
      ? datos.recordatorios.map(Number).filter(n => !isNaN(n))
      : [];
    datos.avisados = typeof datos.avisados === 'object' && datos.avisados !== null ? datos.avisados : {};

    return datos;
  }

  // Edición de un evento existente
  if (usuario.rol !== 'admin' && String(anterior.propietarioId) !== String(usuario.id)) {
    const error = new Error('Solo el propietario puede editar este evento');
    error.estado = 403;
    throw error;
  }

  datos.propietarioId = anterior.propietarioId;

  if (datos.grupoId && datos.grupoId !== anterior.grupoId && datos.grupoId !== 'todos') {
    if (!esDocenteOAdmin) {
      const error = new Error('Solo docentes y administradores pueden modificar el grupo del evento');
      error.estado = 403;
      throw error;
    }

    const misGrupos = await gruposDe(usuario);
    const pertenece = (misGrupos || []).some(g => String(g.id) === String(datos.grupoId));
    if (!pertenece) {
      const error = new Error('No tienes acceso al grupo especificado');
      error.estado = 403;
      throw error;
    }
  }

  if (datos.tipo && !TIPOS_VALIDOS.includes(datos.tipo)) {
    const error = new Error(`Tipo de evento inválido. Debe ser uno de: ${TIPOS_VALIDOS.join(', ')}`);
    error.estado = 400;
    throw error;
  }

  if (datos.recordatorios !== undefined) {
    datos.recordatorios = Array.isArray(datos.recordatorios)
      ? datos.recordatorios.map(Number).filter(n => !isNaN(n))
      : [];
  }

  return datos;
}

/**
 * Emite notificaciones automáticas al crear un evento en la agenda.
 */
export async function despuesDeGuardar(registro, usuario, anterior) {
  if (!registro || anterior) return;

  // No saturar con notificaciones automáticas de festividades del sistema
  if (registro.tipo === 'festividad') return;

  try {
    const esInstitucional = Boolean(registro.esInstitucional || !registro.grupoId || registro.grupoId === 'todos');

    if (esInstitucional) {
      // Evento general institucional: notificar a todos los usuarios activos (excepto creador)
      const todosUsuarios = await almacen.leer('usuarios');
      for (const u of todosUsuarios || []) {
        if (u && u.activo !== false && String(u.id) !== String(usuario.id)) {
          await notificar(u.id, {
            tipo: 'agenda',
            mensaje: `Nuevo evento en agenda: "${registro.titulo}"`,
            enlace: '/paginas/agenda.html'
          });
        }
      }
    } else if (registro.grupoId) {
      // Evento de paralelo / grupo: notificar a docentes y estudiantes del grupo
      const distributivo = await almacen.leer('distributivo');
      const grupo = (distributivo || []).find(g => String(g.id) === String(registro.grupoId));

      if (grupo) {
        const destinatarios = new Set();
        docentesIdsDeGrupo(grupo)
          .filter(docenteId => docenteId !== String(usuario.id))
          .forEach(docenteId => destinatarios.add(docenteId));
        if (Array.isArray(grupo.estudiantes)) {
          for (const estId of grupo.estudiantes) {
            if (String(estId) !== String(usuario.id)) {
              destinatarios.add(String(estId));
            }
          }
        }

        for (const destId of destinatarios) {
          await notificar(destId, {
            tipo: 'agenda',
            mensaje: `Nuevo evento para tu paralelo: "${registro.titulo}"`,
            enlace: '/paginas/agenda.html'
          });
        }
      }
    }
  } catch (err) {
    console.error('Error al emitir notificación de agenda:', err);
  }
}

export default {
  filtrarLista,
  antesDeGuardar,
  despuesDeGuardar
};
