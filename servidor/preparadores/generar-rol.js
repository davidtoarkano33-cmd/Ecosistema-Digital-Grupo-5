// servidor/preparadores/generar-rol.js · Contexto seguro para generar prácticas de rol
import * as almacen from '../almacen.js';
import { asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

function rechazar(mensaje, estado = 400) {
  const error = new Error(mensaje);
  error.estado = estado;
  throw error;
}

export default async function prepararGeneracionRol(cuerpo, usuario) {
  const temaId = String(cuerpo?.temaId || '').trim();
  const situacion = String(cuerpo?.situacion || '').trim();
  if (!temaId) rechazar('Selecciona un tema antes de generar la práctica');
  if (!situacion || situacion.length > 800) rechazar('La situación es obligatoria y no puede superar 800 caracteres');

  const [tema] = await almacen.buscar('temas', { id: temaId });
  if (!tema) rechazar('Tema no encontrado', 404);
  const asignaturaId = await asignaturaDeTema(temaId);
  if (!asignaturaId) rechazar('No se pudo determinar la asignatura del tema', 404);
  if (!await puedeEditarAsignatura(usuario, asignaturaId)) rechazar('No tienes permiso para generar una práctica en este tema', 403);
  const [asignatura] = await almacen.buscar('asignaturas', { id: asignaturaId });

  const contenido = [
    tema.objetivos?.length ? `Objetivos:\n${tema.objetivos.map(item => `- ${item}`).join('\n')}` : '',
    tema.resumen ? `Resumen:\n${tema.resumen}` : '',
    tema.ejemplos?.length ? `Ejemplos:\n${tema.ejemplos.map(item => `- ${item}`).join('\n')}` : '',
    tema.erroresFrecuentes?.length ? `Errores frecuentes:\n${tema.erroresFrecuentes.map(item => `- ${item}`).join('\n')}` : ''
  ].filter(Boolean).join('\n\n');

  return {
    asignatura: asignatura?.nombre || 'Asignatura',
    nivel: asignatura?.nivel || 'Nivel superior',
    tema: tema.titulo,
    contenido: contenido || tema.titulo,
    situacion
  };
}
