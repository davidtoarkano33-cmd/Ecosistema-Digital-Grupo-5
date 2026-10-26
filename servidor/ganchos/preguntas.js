// servidor/ganchos/preguntas.js · Acceso y validación del banco de preguntas
import * as almacen from '../almacen.js';
import { asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

function rechazar(mensaje, estado = 400) {
  const error = new Error(mensaje);
  error.estado = estado;
  throw error;
}

async function puedeEditarTema(usuario, temaId) {
  const asignaturaId = await asignaturaDeTema(temaId);
  return asignaturaId && await puedeEditarAsignatura(usuario, asignaturaId);
}

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const resultado = [];
  const permisosPorTema = new Map();
  for (const pregunta of lista) {
    if (!permisosPorTema.has(pregunta.temaId)) {
      permisosPorTema.set(pregunta.temaId, await puedeEditarTema(usuario, pregunta.temaId));
    }
    if (permisosPorTema.get(pregunta.temaId)) resultado.push(pregunta);
  }
  return resultado;
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) rechazar('Sesión requerida', 401);

  const combinado = { ...(anterior || {}), ...(datos || {}) };
  if (!combinado.temaId) rechazar('El tema es requerido');
  if (!await puedeEditarTema(usuario, combinado.temaId)) {
    rechazar('No tienes permiso para editar preguntas de este tema', 403);
  }

  const nivel = Number(combinado.nivel);
  if (!Number.isInteger(nivel) || nivel < 1 || nivel > 5) rechazar('El nivel debe estar entre 1 y 5');
  if (!['opcion', 'vf', 'completar'].includes(combinado.tipo)) rechazar('Tipo de pregunta no válido');
  if (typeof combinado.enunciado !== 'string' || !combinado.enunciado.trim()) rechazar('El enunciado es obligatorio');
  if (!Array.isArray(combinado.opciones)) rechazar('Las opciones deben ser una lista');
  if (typeof combinado.retroalimentacion !== 'string' || !combinado.retroalimentacion.trim()) {
    rechazar('La retroalimentación es obligatoria');
  }

  if (combinado.tipo === 'opcion') {
    if (combinado.opciones.length !== 4 || combinado.opciones.some(item => typeof item !== 'string' || !item.trim())) {
      rechazar('Una pregunta de opción debe tener exactamente 4 opciones');
    }
    if (!Number.isInteger(combinado.correcta) || combinado.correcta < 0 || combinado.correcta > 3) {
      rechazar('La respuesta correcta debe ser un índice entre 0 y 3');
    }
  }
  if (combinado.tipo === 'vf') {
    if (combinado.opciones.length !== 2 || combinado.opciones[0] !== 'Verdadero' || combinado.opciones[1] !== 'Falso') {
      rechazar('Verdadero/falso debe usar las opciones establecidas');
    }
    if (typeof combinado.correcta !== 'boolean') rechazar('La respuesta correcta debe ser verdadera o falsa');
  }
  if (combinado.tipo === 'completar') {
    if (!combinado.enunciado.includes('____')) rechazar('El enunciado debe incluir ____');
    if (combinado.opciones.length !== 0) rechazar('Las preguntas de completar no llevan opciones');
    if (typeof combinado.correcta !== 'string' || !combinado.correcta.trim()) rechazar('La respuesta correcta es obligatoria');
  }

  if (!['docente', 'ia'].includes(combinado.origen)) rechazar('Origen de pregunta no válido');
  if (combinado.estado !== 'aprobado') rechazar('El estado debe ser aprobado');

  const [tema] = await almacen.buscar('temas', { id: combinado.temaId });
  if (!tema) rechazar('Tema no encontrado', 404);

  return datos;
}

export default { filtrarLista, antesDeGuardar };
