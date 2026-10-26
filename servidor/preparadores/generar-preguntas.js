// servidor/preparadores/generar-preguntas.js · Contexto seguro para generar preguntas
import * as almacen from '../almacen.js';
import { asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

const NIVELES_BLOOM = {
  1: 'Recordar',
  2: 'Comprender',
  3: 'Aplicar',
  4: 'Analizar',
  5: 'Evaluar'
};

function errorConEstado(mensaje, estado) {
  const error = new Error(mensaje);
  error.estado = estado;
  return error;
}

export default async function prepararPreguntas(cuerpo, usuario) {
  const { temaId } = cuerpo || {};
  const nivelNumero = Number(cuerpo?.nivel);
  const cantidadNumero = Number(cuerpo?.cantidad ?? 10);

  if (!temaId) throw errorConEstado('temaId es requerido', 400);
  if (!Number.isInteger(nivelNumero) || nivelNumero < 1 || nivelNumero > 5) {
    throw errorConEstado('El nivel debe ser un entero entre 1 y 5', 400);
  }
  if (!Number.isInteger(cantidadNumero) || cantidadNumero < 5 || cantidadNumero > 15) {
    throw errorConEstado('La cantidad debe ser un entero entre 5 y 15', 400);
  }

  const [tema] = await almacen.buscar('temas', { id: temaId });
  if (!tema) throw errorConEstado('Tema no encontrado', 404);

  const asignaturaId = await asignaturaDeTema(temaId);
  if (!asignaturaId) throw errorConEstado('No se pudo determinar la asignatura del tema', 404);
  if (!await puedeEditarAsignatura(usuario, asignaturaId)) {
    throw errorConEstado('No tienes permiso para generar preguntas en este tema', 403);
  }

  const [[asignatura], [unidad], glosario, preguntas] = await Promise.all([
    almacen.buscar('asignaturas', { id: asignaturaId }),
    almacen.buscar('unidades', { id: tema.unidadId }),
    almacen.buscar('glosario', { temaId }),
    almacen.buscar('preguntas', { temaId, nivel: nivelNumero })
  ]);

  const contenido = [
    tema.objetivos?.length ? `Objetivos:\n${tema.objetivos.map(item => `- ${item}`).join('\n')}` : '',
    tema.resumen ? `Resumen:\n${tema.resumen}` : '',
    tema.ejemplos?.length ? `Ejemplos:\n${tema.ejemplos.map(item => `- ${item}`).join('\n')}` : '',
    tema.erroresFrecuentes?.length ? `Errores frecuentes:\n${tema.erroresFrecuentes.map(item => `- ${item}`).join('\n')}` : '',
    tema.preguntasGuia?.length ? `Preguntas guía:\n${tema.preguntasGuia.map(item => `- ${item}`).join('\n')}` : ''
  ].filter(Boolean).join('\n\n');

  const glosarioTexto = glosario
    .filter(item => item.estado === 'aprobado' && item.termino && item.definicion)
    .map(item => `${item.termino}: ${item.definicion}`)
    .join('\n');

  const existentes = preguntas
    .map(item => item.enunciado?.trim())
    .filter(Boolean)
    .join('\n');

  return {
    asignatura: asignatura?.nombre || 'Asignatura',
    nivel: asignatura?.nivel || 'Nivel no especificado',
    unidad: unidad?.titulo || 'Unidad no especificada',
    tema: tema.titulo,
    objetivos: tema.objetivos?.length ? tema.objetivos.join('\n') : 'No especificados',
    contenido: contenido || tema.titulo,
    glosario: glosarioTexto || 'Sin términos aprobados',
    nivelBloom: `${nivelNumero} ${NIVELES_BLOOM[nivelNumero]}`,
    cantidad: cantidadNumero,
    existentes: existentes || 'Ninguna'
  };
}
