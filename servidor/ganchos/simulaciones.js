// servidor/ganchos/simulaciones.js · Reglas de acceso y validación para simulaciones
import * as almacen from '../almacen.js';
import { asignaturasDe, asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

function errorValidacion(mensaje) {
  const error = new Error(mensaje);
  error.estado = 400;
  return error;
}

function validarEscenarioPublicado(datos) {
  if (datos.modo !== 'escenarios' || datos.estado !== 'publicado') return;
  const escenas = Array.isArray(datos.escenas) ? datos.escenas : [];
  if (!escenas.length) throw errorValidacion('La simulación publicada debe tener escenas');

  const porId = new Map();
  for (const escena of escenas) {
    const id = String(escena?.id || '').trim();
    if (!id || porId.has(id)) throw errorValidacion('Cada escena debe tener un identificador único');
    porId.set(id, escena);
  }
  if (!porId.has(datos.escenaInicial)) throw errorValidacion('La escena inicial no existe');
  if (!escenas.some(escena => Array.isArray(escena.opciones) && escena.opciones.length === 0)) {
    throw errorValidacion('Debe existir al menos una escena final sin opciones');
  }

  for (const escena of escenas) {
    if (!String(escena.texto || '').trim()) throw errorValidacion(`La escena ${escena.id} necesita texto`);
    const opciones = Array.isArray(escena.opciones) ? escena.opciones : [];
    if (opciones.length === 1 || opciones.length > 4) {
      throw errorValidacion(`La escena ${escena.id} debe tener entre 2 y 4 opciones o ser final`);
    }
    for (const opcion of opciones) {
      if (!String(opcion.texto || '').trim()) throw errorValidacion(`Una opción de ${escena.id} necesita texto`);
      if (!porId.has(opcion.destino)) throw errorValidacion(`La escena ${escena.id} tiene un destino inexistente`);
      if (!String(opcion.consecuencia || '').trim()) throw errorValidacion(`Una opción de ${escena.id} necesita consecuencia`);
      const puntos = Number(opcion.puntos);
      if (!Number.isInteger(puntos) || puntos < -10 || puntos > 10) {
        throw errorValidacion(`Los puntos de ${escena.id} deben estar entre -10 y 10`);
      }
    }
  }

  const alcanzables = new Set();
  const visitando = new Set();
  function recorrer(id) {
    if (visitando.has(id)) throw errorValidacion('El escenario no puede contener ciclos');
    if (alcanzables.has(id)) return;
    visitando.add(id);
    alcanzables.add(id);
    for (const opcion of porId.get(id).opciones) recorrer(opcion.destino);
    visitando.delete(id);
  }
  recorrer(datos.escenaInicial);
  if (alcanzables.size !== escenas.length) throw errorValidacion('Todas las escenas deben ser alcanzables desde la inicial');
}

function validarRolPublicado(datos) {
  if (datos.modo !== 'rol' || datos.estado !== 'publicado') return;
  const personaje = datos.personaje || {};
  for (const campo of ['nombre', 'descripcion', 'contexto', 'objetivo']) {
    if (!String(personaje[campo] || '').trim()) throw errorValidacion(`El campo ${campo} del personaje es obligatorio`);
  }
  const maxTurnos = Number(datos.maxTurnos);
  if (!Number.isInteger(maxTurnos) || maxTurnos < 4 || maxTurnos > 12) throw errorValidacion('El máximo de turnos debe estar entre 4 y 12');
  const rubrica = Array.isArray(datos.rubrica) ? datos.rubrica : [];
  if (rubrica.length < 3 || rubrica.length > 5) throw errorValidacion('La rúbrica debe tener entre 3 y 5 criterios');
  for (const item of rubrica) {
    if (!String(item.criterio || '').trim() || !String(item.descripcion || '').trim() || !Number.isFinite(Number(item.puntos)) || Number(item.puntos) <= 0) {
      throw errorValidacion('Todos los criterios deben incluir nombre, descripción y puntos máximos');
    }
  }
}

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];

  // El administrador tiene acceso a todas las simulaciones
  if (usuario.rol === 'admin') {
    return lista;
  }

  // Obtener las asignaturas asignadas al usuario
  const misAsignaturas = await asignaturasDe(usuario);
  const misAsigIds = new Set(misAsignaturas.map(a => a.id));

  // Mapa de temaId -> asignaturaId
  const temas = await almacen.leer('temas');
  const unidades = await almacen.leer('unidades');
  const mapaUnidadAsignatura = new Map((unidades || []).map(u => [u.id, u.asignaturaId]));
  const mapaTemaAsignatura = new Map((temas || []).map(t => [t.id, mapaUnidadAsignatura.get(t.unidadId)]));

  return lista.filter(sim => {
    if (!sim || !sim.temaId) return false;
    const asigId = mapaTemaAsignatura.get(sim.temaId);
    if (!asigId || !misAsigIds.has(asigId)) return false;

    // Los estudiantes solo ven las publicadas de sus asignaturas
    if (usuario.rol === 'estudiante') {
      return sim.estado === 'publicado';
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

  if (usuario.rol !== 'docente' && usuario.rol !== 'admin') {
    const error = new Error('No tienes permisos para crear o editar simulaciones');
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
    error.estado = 404;
    throw error;
  }

  const permitido = await puedeEditarAsignatura(usuario, asignaturaId);
  if (!permitido) {
    const error = new Error('No tienes permiso para editar simulaciones en esta asignatura');
    error.estado = 403;
    throw error;
  }

  const completo = anterior ? { ...anterior, ...datos } : datos;
  validarEscenarioPublicado(completo);
  validarRolPublicado(completo);

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
