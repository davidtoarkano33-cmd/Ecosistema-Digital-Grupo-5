// servidor/preparadores/tutor.js · Contexto seguro para el tutor socrático
import * as almacen from '../almacen.js';
import { asignaturasDe } from '../acceso.js';

function rechazar(mensaje, estado = 400) {
  const error = new Error(mensaje);
  error.estado = estado;
  throw error;
}

function bloque(titulo, valores) {
  if (!Array.isArray(valores) || valores.length === 0) return '';
  return `${titulo}:\n${valores.map(valor => `- ${valor}`).join('\n')}`;
}

export default async function prepararTutor(cuerpo, usuario) {
  const temaId = String(cuerpo?.temaId || '').trim();
  if (!temaId) rechazar('temaId es requerido');
  if (!Array.isArray(cuerpo?.historial)) rechazar('El historial debe ser una lista');

  const historialReciente = cuerpo.historial.slice(-10).map((mensaje, indice) => {
    if (!mensaje || !['estudiante', 'tutor'].includes(mensaje.rol)) {
      rechazar(`Rol no válido en el mensaje ${indice + 1}`);
    }
    if (typeof mensaje.texto !== 'string') {
      rechazar(`Texto no válido en el mensaje ${indice + 1}`);
    }
    const texto = mensaje.texto.trim();
    if (!texto) rechazar(`El mensaje ${indice + 1} está vacío`);
    if (texto.length > 1000) rechazar('Cada mensaje puede tener hasta 1.000 caracteres');
    return { rol: mensaje.rol, texto };
  });

  const ultimoEstudiante = [...historialReciente].reverse().find(mensaje => mensaje.rol === 'estudiante');
  if (!ultimoEstudiante) rechazar('El historial debe incluir un mensaje del estudiante');

  const [tema] = await almacen.buscar('temas', { id: temaId });
  if (!tema) rechazar('Tema no encontrado', 404);
  const [unidad] = await almacen.buscar('unidades', { id: tema.unidadId });
  if (!unidad) rechazar('Unidad no encontrada', 404);
  const [asignatura] = await almacen.buscar('asignaturas', { id: unidad.asignaturaId });
  if (!asignatura) rechazar('Asignatura no encontrada', 404);

  const permitidas = await asignaturasDe(usuario);
  if (!permitidas.some(item => String(item.id) === String(asignatura.id))) {
    rechazar('No tienes acceso a este tema', 403);
  }
  if (usuario.rol === 'estudiante' && (unidad.visible === false || tema.estado !== 'publicado')) {
    rechazar('Este tema no está disponible', 403);
  }

  const glosario = (await almacen.buscar('glosario', { temaId }))
    .filter(item => item.estado === 'aprobado' && item.termino && item.definicion)
    .slice(0, 30);

  const contenido = [
    bloque('Objetivos', tema.objetivos),
    tema.resumen ? `Resumen:\n${tema.resumen}` : '',
    bloque('Ejemplos', tema.ejemplos),
    bloque('Errores frecuentes', tema.erroresFrecuentes),
    bloque('Preguntas guía', tema.preguntasGuia),
    glosario.length
      ? `Glosario:\n${glosario.map(item => `- ${item.termino}: ${item.definicion}`).join('\n')}`
      : ''
  ].filter(Boolean).join('\n\n');

  return {
    asignatura: asignatura.nombre,
    nivel: asignatura.nivel || 'Nivel no especificado',
    tema: tema.titulo,
    contenido: contenido || tema.titulo,
    historial: historialReciente
      .map(mensaje => `${mensaje.rol === 'estudiante' ? 'Estudiante' : 'Tutor'}: ${mensaje.texto}`)
      .join('\n'),
    pregunta: ultimoEstudiante.texto
  };
}
