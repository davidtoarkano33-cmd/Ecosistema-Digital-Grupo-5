// servidor/preparadores/generar-contenidos-asignatura.js · Contexto para diseñar una asignatura
import * as almacen from '../almacen.js';
import { puedeEditarAsignatura } from '../acceso.js';

function errorConEstado(mensaje, estado) {
  const error = new Error(mensaje);
  error.estado = estado;
  return error;
}

function textoLimitado(valor, maximo) {
  return String(valor || '').trim().slice(0, maximo);
}

export default async function prepararContenidosAsignatura(cuerpo, usuario) {
  const asignaturaId = textoLimitado(cuerpo?.asignaturaId, 80);
  const instrucciones = textoLimitado(cuerpo?.instrucciones, 2000);
  const materialApoyo = textoLimitado(cuerpo?.materialApoyo, 6000);
  const cantidadUnidades = Number(cuerpo?.cantidadUnidades ?? 3);
  const temasPorUnidad = Number(cuerpo?.temasPorUnidad ?? 3);

  if (!asignaturaId) throw errorConEstado('La asignatura es requerida', 400);
  if (!instrucciones && !materialApoyo) {
    throw errorConEstado('Escribe indicaciones o adjunta material de apoyo', 400);
  }
  if (!Number.isInteger(cantidadUnidades) || cantidadUnidades < 1 || cantidadUnidades > 6) {
    throw errorConEstado('La cantidad de unidades debe estar entre 1 y 6', 400);
  }
  if (!Number.isInteger(temasPorUnidad) || temasPorUnidad < 1 || temasPorUnidad > 6) {
    throw errorConEstado('La cantidad de temas por unidad debe estar entre 1 y 6', 400);
  }
  if (cantidadUnidades * temasPorUnidad > 18) {
    throw errorConEstado('Genera hasta 18 temas por propuesta para poder revisar el resultado', 400);
  }

  const [asignatura] = await almacen.buscar('asignaturas', { id: asignaturaId });
  if (!asignatura) throw errorConEstado('Asignatura no encontrada', 404);
  if (!await puedeEditarAsignatura(usuario, asignaturaId)) {
    throw errorConEstado('No tienes permiso para generar contenidos en esta asignatura', 403);
  }

  const unidades = (await almacen.buscar('unidades', { asignaturaId }))
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const temas = await almacen.leer('temas');
  const unidadesIds = new Set(unidades.map(unidad => unidad.id));
  const estructuraActual = unidades.map(unidad => ({
    unidad: unidad.titulo,
    temas: temas
      .filter(tema => unidadesIds.has(tema.unidadId) && tema.unidadId === unidad.id)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      .map(tema => tema.titulo)
  }));

  return {
    asignatura: asignatura.nombre,
    nivel: asignatura.nivel || 'Nivel no especificado',
    descripcion: asignatura.descripcion || 'Sin descripción registrada',
    instrucciones: instrucciones || 'Organiza el material de apoyo en una secuencia didáctica coherente.',
    materialApoyo: materialApoyo || 'No se adjuntó material adicional.',
    estructuraActual: estructuraActual.length ? JSON.stringify(estructuraActual) : 'La asignatura todavía no tiene contenidos.',
    cantidadUnidades,
    temasPorUnidad
  };
}
