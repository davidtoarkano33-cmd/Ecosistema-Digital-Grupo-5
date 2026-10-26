// servidor/preparadores/generar-glosario.js · Preparador de contexto para generar glosario
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

export default async function prepararGlosario(cuerpo, usuario) {
  const { temaId, cantidad = 10 } = cuerpo || {};

  if (!temaId) {
    const error = new Error('temaId es requerido');
    error.estado = 400;
    throw error;
  }

  // Verificar cantidad (5 a 20)
  const cantNum = parseInt(cantidad, 10);
  if (Number.isNaN(cantNum) || cantNum < 5 || cantNum > 20) {
    const error = new Error('La cantidad de términos debe estar entre 5 y 20');
    error.estado = 400;
    throw error;
  }

  // Obtener tema
  const temas = await almacen.buscar('temas', { id: temaId });
  const tema = temas[0];
  if (!tema) {
    const error = new Error('Tema no encontrado');
    error.estado = 404;
    throw error;
  }

  // Verificar que el usuario puede editar la asignatura del tema
  const asignaturaId = await acceso.asignaturaDeTema(temaId);
  if (!asignaturaId) {
    const error = new Error('No se pudo determinar la asignatura del tema');
    error.estado = 404;
    throw error;
  }

  const puedeEditar = await acceso.puedeEditarAsignatura(usuario, asignaturaId);
  if (!puedeEditar) {
    const error = new Error('No tienes permiso para generar contenido en este tema');
    error.estado = 403;
    throw error;
  }

  // Obtener asignatura
  const asignaturas = await almacen.buscar('asignaturas', { id: asignaturaId });
  const asig = asignaturas[0];

  // Términos existentes del glosario
  const glosarioExistente = await almacen.buscar('glosario', { temaId });
  const terminosExistentes = (glosarioExistente || [])
    .map(g => (g.termino || '').trim())
    .filter(Boolean);

  // Armar bloque de contenido del tema
  const partesContenido = [];
  if (Array.isArray(tema.objetivos) && tema.objetivos.length > 0) {
    partesContenido.push(`Objetivos:\n${tema.objetivos.map(o => `- ${o}`).join('\n')}`);
  }
  if (tema.resumen) {
    partesContenido.push(`Resumen:\n${tema.resumen}`);
  }
  if (Array.isArray(tema.ejemplos) && tema.ejemplos.length > 0) {
    partesContenido.push(`Ejemplos:\n${tema.ejemplos.map(e => `- ${e}`).join('\n')}`);
  }

  const contenidoTexto = partesContenido.join('\n\n') || tema.titulo;

  return {
    asignatura: asig ? asig.nombre : 'General',
    nivel: asig ? (asig.nivel || 'Nivel Superior') : 'Superior',
    tema: tema.titulo,
    contenido: contenidoTexto,
    existentes: terminosExistentes.length > 0 ? terminosExistentes.join(', ') : 'Ninguno',
    cantidad: cantNum,
    minimoSeisLetras: 3
  };
}
