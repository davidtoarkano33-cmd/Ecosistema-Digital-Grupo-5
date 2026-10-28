// servidor/preparadores/evaluar-rol.js · Contexto seguro para evaluar una práctica de rol
import * as almacen from '../almacen.js';
import { asignaturaDeTema, asignaturasDe } from '../acceso.js';

function rechazar(mensaje, estado = 400) {
  const error = new Error(mensaje);
  error.estado = estado;
  throw error;
}

export default async function prepararEvaluacionRol(cuerpo, usuario) {
  const simulacionId = String(cuerpo?.simulacionId || '').trim();
  if (!simulacionId) rechazar('simulacionId es requerido');
  const [simulacion] = await almacen.buscar('simulaciones', { id: simulacionId });
  if (!simulacion) rechazar('Simulación no encontrada', 404);
  if (simulacion.modo !== 'rol') rechazar('La simulación no corresponde al modo rol');
  const asignaturaId = await asignaturaDeTema(simulacion.temaId);
  const permitidas = await asignaturasDe(usuario);
  if (!asignaturaId || !permitidas.some(item => item.id === asignaturaId)) rechazar('No tienes acceso a esta simulación', 403);
  if (usuario.rol === 'estudiante' && simulacion.estado !== 'publicado') rechazar('La simulación no está publicada', 403);

  const maxTurnos = Math.max(4, Math.min(12, Number(simulacion.maxTurnos) || 8));
  if (!Array.isArray(cuerpo?.historial)) rechazar('El historial debe ser una lista');
  const historial = cuerpo.historial.slice(-(maxTurnos * 2)).map((item, indice) => {
    if (!item || !['estudiante', 'personaje'].includes(item.rol)) rechazar(`Rol no válido en el mensaje ${indice + 1}`);
    const texto = String(item.texto || '').trim();
    if (!texto || texto.length > 1000) rechazar('Cada mensaje debe tener entre 1 y 1.000 caracteres');
    return { rol: item.rol, texto };
  });
  const personaje = simulacion.personaje || {};
  const rubrica = Array.isArray(simulacion.rubrica) ? simulacion.rubrica : [];
  return {
    personaje: `${personaje.nombre || 'Personaje'}: ${personaje.descripcion || 'Sin descripción'}`,
    objetivo: personaje.objetivo || '',
    rubrica: rubrica.map(item => `${item.criterio}: ${item.descripcion} (máximo ${Number(item.puntos) || 0} puntos)`).join('\n'),
    transcripcion: historial.map(item => `${item.rol === 'estudiante' ? 'Estudiante' : personaje.nombre || 'Personaje'}: ${item.texto}`).join('\n')
  };
}
