// servidor/esquemas-ia.js · Validadores de esquema para respuestas de IA
/**
 * Valida los esquemas requeridos para cada tarea estructurada de IA.
 * Devuelve un booleano o lanza error con detalle.
 */

export function validarEsquema(tarea, datos) {
  if (!datos) return false;

  switch (tarea) {
    case 'generar-glosario': {
      // lista de { termino, definicion, pista, retroalimentacion }
      if (!Array.isArray(datos) || datos.length === 0) return false;
      return datos.every(item =>
        item &&
        typeof item.termino === 'string' && item.termino.trim().length > 0 &&
        typeof item.definicion === 'string' && item.definicion.trim().length > 0 &&
        typeof item.pista === 'string' &&
        typeof item.retroalimentacion === 'string'
      );
    }

    case 'generar-preguntas': {
      // lista de { tipo, enunciado, opciones, correcta, retroalimentacion }
      if (!Array.isArray(datos) || datos.length === 0) return false;
      return datos.every(item =>
        item &&
        typeof item.tipo === 'string' &&
        typeof item.enunciado === 'string' && item.enunciado.trim().length > 0 &&
        Array.isArray(item.opciones) &&
        item.correcta !== undefined &&
        typeof item.retroalimentacion === 'string'
      );
    }

    case 'generar-escenario': {
      // { titulo, escenaInicial, escenas }
      if (typeof datos !== 'object' || Array.isArray(datos)) return false;
      if (typeof datos.titulo !== 'string' || !datos.titulo.trim()) return false;
      if (datos.escenaInicial === undefined) return false;
      if (!Array.isArray(datos.escenas) || datos.escenas.length === 0) return false;
      return true;
    }

    case 'evaluar-rol': {
      // { puntaje, maximo, criterios, comentarioGeneral }
      if (typeof datos !== 'object' || Array.isArray(datos)) return false;
      if (typeof datos.puntaje !== 'number' || typeof datos.maximo !== 'number') return false;
      if (!datos.criterios || typeof datos.criterios !== 'object') return false;
      if (typeof datos.comentarioGeneral !== 'string') return false;
      return true;
    }

    default:
      return true;
  }
}

export default {
  validarEsquema
};
