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
      if (typeof datos.escenaInicial !== 'string' || !datos.escenaInicial.trim()) return false;
      if (!Array.isArray(datos.escenas) || datos.escenas.length < 5 || datos.escenas.length > 10) return false;
      return datos.escenas.every(escena =>
        escena &&
        typeof escena.id === 'string' && escena.id.trim().length > 0 &&
        typeof escena.texto === 'string' && escena.texto.trim().length > 0 &&
        Array.isArray(escena.opciones) && escena.opciones.length <= 4 &&
        escena.opciones.every(opcion =>
          opcion &&
          typeof opcion.texto === 'string' && opcion.texto.trim().length > 0 &&
          typeof opcion.destino === 'string' && opcion.destino.trim().length > 0 &&
          Number.isFinite(opcion.puntos) && opcion.puntos >= -10 && opcion.puntos <= 10 &&
          typeof opcion.consecuencia === 'string' && opcion.consecuencia.trim().length > 0
        )
      );
    }

    case 'generar-rol': {
      if (typeof datos !== 'object' || Array.isArray(datos) || typeof datos.titulo !== 'string' || !datos.titulo.trim()) return false;
      const personaje = datos.personaje;
      if (!personaje || !['nombre', 'descripcion', 'contexto', 'objetivo'].every(campo => typeof personaje[campo] === 'string' && personaje[campo].trim())) return false;
      if (!Array.isArray(datos.rubrica) || datos.rubrica.length < 3 || datos.rubrica.length > 5) return false;
      if (!datos.rubrica.every(item => item && typeof item.criterio === 'string' && item.criterio.trim() && typeof item.descripcion === 'string' && item.descripcion.trim() && Number.isInteger(item.puntos) && item.puntos > 0)) return false;
      return Number.isInteger(datos.maxTurnos) && datos.maxTurnos >= 4 && datos.maxTurnos <= 12;
    }

    case 'generar-contenidos-asignatura': {
      const esListaTexto = (valor, minimo, maximo) =>
        Array.isArray(valor) && valor.length >= minimo && valor.length <= maximo &&
        valor.every(item => typeof item === 'string' && item.trim().length > 0);
      if (typeof datos !== 'object' || Array.isArray(datos) || !Array.isArray(datos.unidades)) return false;
      if (datos.unidades.length < 1 || datos.unidades.length > 6) return false;
      return datos.unidades.every(unidad =>
        unidad &&
        typeof unidad.titulo === 'string' && unidad.titulo.trim() &&
        Array.isArray(unidad.temas) && unidad.temas.length >= 1 && unidad.temas.length <= 6 &&
        unidad.temas.every(tema =>
          tema &&
          typeof tema.titulo === 'string' && tema.titulo.trim() &&
          esListaTexto(tema.objetivos, 1, 6) &&
          typeof tema.resumen === 'string' && tema.resumen.trim() &&
          esListaTexto(tema.ejemplos, 1, 5) &&
          esListaTexto(tema.erroresFrecuentes, 1, 5) &&
          esListaTexto(tema.preguntasGuia, 1, 6) &&
          esListaTexto(tema.palabrasClave, 1, 10) &&
          ['basico', 'intermedio', 'avanzado'].includes(tema.dificultad) &&
          typeof tema.fuentes === 'string'
        )
      );
    }

    case 'evaluar-rol': {
      // { puntaje, maximo, criterios, comentarioGeneral }
      if (typeof datos !== 'object' || Array.isArray(datos)) return false;
      if (typeof datos.puntaje !== 'number' || typeof datos.maximo !== 'number') return false;
      if (!Array.isArray(datos.criterios) || datos.criterios.length === 0) return false;
      if (!datos.criterios.every(item => item && typeof item.criterio === 'string' && typeof item.puntos === 'number' && typeof item.comentario === 'string')) return false;
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
