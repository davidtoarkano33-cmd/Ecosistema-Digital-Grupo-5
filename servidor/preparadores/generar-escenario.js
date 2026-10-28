// servidor/preparadores/generar-escenario.js · Contexto seguro para generar escenarios
import * as almacen from '../almacen.js';
import { asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

function errorConEstado(mensaje, estado) {
  const error = new Error(mensaje);
  error.estado = estado;
  return error;
}

export default async function prepararEscenario(cuerpo, usuario) {
  const temaId = String(cuerpo?.temaId || '').trim();
  const situacion = String(cuerpo?.situacion || '').trim();
  const cantidadEscenas = Number(cuerpo?.escenas ?? 6);

  if (!temaId) throw errorConEstado('Selecciona un tema antes de generar el escenario', 400);
  if (!situacion || situacion.length > 800) {
    throw errorConEstado('La situación es obligatoria y no puede superar 800 caracteres', 400);
  }
  if (!Number.isInteger(cantidadEscenas) || cantidadEscenas < 5 || cantidadEscenas > 10) {
    throw errorConEstado('La cantidad de escenas debe ser un entero entre 5 y 10', 400);
  }

  const [tema] = await almacen.buscar('temas', { id: temaId });
  if (!tema) throw errorConEstado('Tema no encontrado', 404);

  const asignaturaId = await asignaturaDeTema(temaId);
  if (!asignaturaId) throw errorConEstado('No se pudo determinar la asignatura del tema', 404);
  if (!await puedeEditarAsignatura(usuario, asignaturaId)) {
    throw errorConEstado('No tienes permiso para generar escenarios en este tema', 403);
  }

  const [asignaturas, unidades] = await Promise.all([
    almacen.buscar('asignaturas', { id: asignaturaId }),
    almacen.buscar('unidades', { id: tema.unidadId })
  ]);
  const asignatura = asignaturas[0];
  const unidad = unidades[0];
  const contenido = [
    unidad?.titulo ? `Unidad: ${unidad.titulo}` : '',
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
    situacion,
    escenas: cantidadEscenas
  };
}
