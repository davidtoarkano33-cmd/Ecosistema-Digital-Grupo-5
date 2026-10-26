// servidor/rutas/quiz.js · Motor progresivo del cuestionario por niveles
import { Router } from 'express';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';
import { procesarIntento } from '../gamificacion.js';
import { notificar } from '../notificar.js';

const router = Router();
const NOMBRES_NIVEL = ['Recordar', 'Comprender', 'Aplicar', 'Analizar', 'Evaluar'];

function rechazar(mensaje, estado = 400) {
  const error = new Error(mensaje);
  error.estado = estado;
  throw error;
}

function validarEstudiante(usuario) {
  if (!usuario) rechazar('Sesión requerida', 401);
  if (usuario.rol !== 'estudiante') rechazar('El cuestionario está disponible únicamente para estudiantes', 403);
}

function validarNivel(valor) {
  const nivel = Number(valor);
  if (!Number.isInteger(nivel) || nivel < 1 || nivel > 5) {
    rechazar('El nivel debe ser un entero entre 1 y 5');
  }
  return nivel;
}

function barajar(lista) {
  const copia = [...lista];
  for (let indice = copia.length - 1; indice > 0; indice--) {
    const aleatorio = Math.floor(Math.random() * (indice + 1));
    [copia[indice], copia[aleatorio]] = [copia[aleatorio], copia[indice]];
  }
  return copia;
}

function normalizar(texto) {
  if (texto === null || texto === undefined) return '';
  let resultado = String(texto).trim().toUpperCase().replace(/Ñ/g, '\uE000');
  resultado = resultado.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return resultado.replace(/\uE000/g, 'Ñ');
}

async function temaAccesible(usuario, temaId) {
  if (!temaId) rechazar('temaId es requerido');
  const [tema] = await almacen.buscar('temas', { id: temaId });
  if (!tema) rechazar('Tema no encontrado', 404);
  const [unidad] = await almacen.buscar('unidades', { id: tema.unidadId });
  if (!unidad) rechazar('Unidad del tema no encontrada', 404);
  if (tema.estado !== 'publicado' || unidad.visible === false) {
    rechazar('Este tema no está disponible para estudiantes', 403);
  }

  const asignaturas = await acceso.asignaturasDe(usuario);
  if (!asignaturas.some(item => String(item.id) === String(unidad.asignaturaId))) {
    rechazar('No tienes acceso a este tema', 403);
  }
  return { tema, unidad };
}

async function logroDe(usuarioId) {
  const [logro] = await almacen.buscar('logros', { usuarioId });
  return logro || { puntos: 0, insignias: [], nivelQuiz: {} };
}

function nivelMaximoAprobado(logro, temaId) {
  const valor = Number(logro?.nivelQuiz?.[temaId] || 0);
  return Number.isInteger(valor) ? Math.min(5, Math.max(0, valor)) : 0;
}

function estadoDelNivel(nivel, maximoAprobado) {
  if (nivel <= maximoAprobado) return 'aprobado';
  if (nivel === 1 || nivel === maximoAprobado + 1) return 'disponible';
  return 'bloqueado';
}

async function notificarBancoInsuficiente(usuario, tema, unidad, nivel) {
  const grupos = await acceso.gruposDe(usuario);
  const relacionados = grupos.filter(grupo => String(grupo.asignaturaId) === String(unidad.asignaturaId));
  const docentes = [...new Set(relacionados.map(grupo => grupo.docenteId).filter(Boolean).map(String))];
  const hoy = new Date().toISOString().slice(0, 10);
  const enlace = `/paginas/banco-preguntas.html?temaId=${encodeURIComponent(tema.id)}&nivel=${nivel}`;

  for (const docenteId of docentes) {
    const previas = await almacen.buscar('notificaciones', { usuarioId: docenteId });
    const yaNotificado = previas.some(item =>
      item.tipo === 'quiz-banco-insuficiente' &&
      item.enlace === enlace &&
      String(item.fecha || '').slice(0, 10) === hoy
    );
    if (yaNotificado) continue;
    await notificar(docenteId, {
      tipo: 'quiz-banco-insuficiente',
      mensaje: `El banco del tema “${tema.titulo}”, nivel ${nivel}, necesita más preguntas nuevas.`,
      enlace
    });
  }
}

function respuestaCorrectaTexto(pregunta) {
  if (pregunta.tipo === 'opcion') return String(pregunta.opciones?.[Number(pregunta.correcta)] ?? '');
  if (pregunta.tipo === 'vf') return pregunta.correcta === true ? 'Verdadero' : 'Falso';
  return String(pregunta.correcta ?? '');
}

function evaluarRespuesta(pregunta, respuesta) {
  if (pregunta.tipo === 'opcion') {
    const indice = Number(respuesta);
    if (!Number.isInteger(indice) || indice < 0 || indice >= pregunta.opciones.length) {
      rechazar('La respuesta debe ser el índice de una opción válida');
    }
    return indice === Number(pregunta.correcta);
  }
  if (pregunta.tipo === 'vf') {
    let valor = respuesta;
    if (valor === 'true') valor = true;
    if (valor === 'false') valor = false;
    if (typeof valor !== 'boolean') rechazar('La respuesta debe ser verdadera o falsa');
    return valor === pregunta.correcta;
  }
  if (pregunta.tipo === 'completar') {
    if (typeof respuesta !== 'string') rechazar('La respuesta debe ser texto');
    return normalizar(respuesta) === normalizar(pregunta.correcta);
  }
  rechazar('Tipo de pregunta no válido', 500);
}

async function actualizarNivelAprobado(usuarioId, temaId, nivel) {
  const [existente] = await almacen.buscar('logros', { usuarioId });
  if (existente) {
    const nivelQuiz = { ...(existente.nivelQuiz || {}) };
    nivelQuiz[temaId] = Math.max(Number(nivelQuiz[temaId]) || 0, nivel);
    await almacen.actualizar('logros', existente.id, { nivelQuiz });
    return;
  }
  await almacen.agregar('logros', {
    usuarioId,
    puntos: 0,
    insignias: [],
    nivelQuiz: { [temaId]: nivel }
  });
}

// GET /quiz/estado?temaId=
router.get('/quiz/estado', async (req, res, next) => {
  try {
    validarEstudiante(req.usuario);
    const { temaId } = req.query;
    await temaAccesible(req.usuario, temaId);

    const [logro, intentos] = await Promise.all([
      logroDe(req.usuario.id),
      almacen.buscar('intentos', { usuarioId: req.usuario.id, actividad: 'quiz', temaId })
    ]);
    const maximoAprobado = nivelMaximoAprobado(logro, temaId);

    const niveles = NOMBRES_NIVEL.map((nombre, indice) => {
      const nivel = indice + 1;
      const porcentajes = intentos
        .filter(item => Number(item.nivel) === nivel && Number(item.maximo) > 0)
        .map(item => Math.round((Number(item.puntaje) / Number(item.maximo)) * 100));
      return {
        nivel,
        nombre,
        estado: estadoDelNivel(nivel, maximoAprobado),
        mejorPorcentaje: porcentajes.length ? Math.max(...porcentajes) : 0
      };
    });
    res.json({ niveles });
  } catch (error) {
    if (error.estado) return res.status(error.estado).json({ error: error.message });
    next(error);
  }
});

// POST /quiz/iniciar
router.post('/quiz/iniciar', async (req, res, next) => {
  try {
    validarEstudiante(req.usuario);
    const { temaId } = req.body || {};
    const nivel = validarNivel(req.body?.nivel);
    const { tema, unidad } = await temaAccesible(req.usuario, temaId);

    const [reglas, logro, candidatas, sesiones] = await Promise.all([
      almacen.leerConfig('reglas-gamificacion'),
      logroDe(req.usuario.id),
      almacen.buscar('preguntas', { temaId, nivel, estado: 'aprobado' }),
      almacen.buscar('quiz-sesiones', { usuarioId: req.usuario.id, temaId, nivel })
    ]);
    if (estadoDelNivel(nivel, nivelMaximoAprobado(logro, temaId)) === 'bloqueado') {
      rechazar('Debes aprobar el nivel anterior antes de iniciar este nivel', 403);
    }
    if (!candidatas.length) rechazar('Este nivel todavía no tiene preguntas aprobadas', 409);

    const cantidad = Number(reglas?.quiz?.preguntasPorNivel);
    if (!Number.isInteger(cantidad) || cantidad < 1) rechazar('La cantidad de preguntas del quiz no está configurada', 500);

    const ultimaVista = new Map();
    for (const sesion of sesiones) {
      const tiempo = new Date(sesion.inicio || sesion.fecha || 0).getTime() || 0;
      for (const preguntaId of (sesion.preguntasIds || [])) {
        ultimaVista.set(preguntaId, Math.max(ultimaVista.get(preguntaId) || 0, tiempo));
      }
    }

    const nuevas = barajar(candidatas.filter(item => !ultimaVista.has(item.id)));
    const vistas = candidatas
      .filter(item => ultimaVista.has(item.id))
      .sort((a, b) => ultimaVista.get(a.id) - ultimaVista.get(b.id));
    const elegidas = [...nuevas, ...vistas].slice(0, cantidad);

    if (nuevas.length < cantidad) {
      try {
        await notificarBancoInsuficiente(req.usuario, tema, unidad, nivel);
      } catch (errorNotificacion) {
        console.error('No se pudo notificar el banco insuficiente:', errorNotificacion);
      }
    }

    const inicio = new Date().toISOString();
    const sesion = await almacen.agregar('quiz-sesiones', {
      usuarioId: req.usuario.id,
      temaId,
      nivel,
      preguntasIds: elegidas.map(item => item.id),
      respuestas: {},
      inicio,
      finalizada: false
    });

    res.status(201).json({
      sesionId: sesion.id,
      preguntas: elegidas.map(item => ({
        id: item.id,
        tipo: item.tipo,
        enunciado: item.enunciado,
        opciones: Array.isArray(item.opciones) ? item.opciones : []
      }))
    });
  } catch (error) {
    if (error.estado) return res.status(error.estado).json({ error: error.message });
    next(error);
  }
});

// POST /quiz/responder
router.post('/quiz/responder', async (req, res, next) => {
  try {
    validarEstudiante(req.usuario);
    const { sesionId, preguntaId, respuesta } = req.body || {};
    if (!sesionId || !preguntaId || respuesta === undefined) rechazar('sesionId, preguntaId y respuesta son requeridos');

    const [sesion] = await almacen.buscar('quiz-sesiones', { id: sesionId });
    if (!sesion) rechazar('Sesión de quiz no encontrada', 404);
    if (String(sesion.usuarioId) !== String(req.usuario.id)) rechazar('Esta sesión no te pertenece', 403);
    if (sesion.finalizada) rechazar('La sesión ya fue finalizada', 409);
    if (!Array.isArray(sesion.preguntasIds) || !sesion.preguntasIds.includes(preguntaId)) {
      rechazar('La pregunta no pertenece a esta sesión', 400);
    }
    const respuestas = { ...(sesion.respuestas || {}) };
    if (Object.prototype.hasOwnProperty.call(respuestas, preguntaId)) {
      rechazar('Esta pregunta ya fue respondida', 409);
    }

    const [pregunta] = await almacen.buscar('preguntas', { id: preguntaId });
    if (!pregunta) rechazar('Pregunta no encontrada', 404);
    const correcto = evaluarRespuesta(pregunta, respuesta);
    respuestas[preguntaId] = { respuesta, correcto };
    await almacen.actualizar('quiz-sesiones', sesion.id, { respuestas });

    res.json({
      correcto,
      retroalimentacion: pregunta.retroalimentacion,
      correcta: respuestaCorrectaTexto(pregunta)
    });
  } catch (error) {
    if (error.estado) return res.status(error.estado).json({ error: error.message });
    next(error);
  }
});

// POST /quiz/finalizar
router.post('/quiz/finalizar', async (req, res, next) => {
  try {
    validarEstudiante(req.usuario);
    const { sesionId } = req.body || {};
    if (!sesionId) rechazar('sesionId es requerido');
    const [sesion] = await almacen.buscar('quiz-sesiones', { id: sesionId });
    if (!sesion) rechazar('Sesión de quiz no encontrada', 404);
    if (String(sesion.usuarioId) !== String(req.usuario.id)) rechazar('Esta sesión no te pertenece', 403);
    if (sesion.finalizada) rechazar('La sesión ya fue finalizada', 409);
    await temaAccesible(req.usuario, sesion.temaId);

    const preguntas = await Promise.all((sesion.preguntasIds || []).map(async id => {
      const [pregunta] = await almacen.buscar('preguntas', { id });
      return pregunta;
    }));
    const validas = preguntas.filter(Boolean);
    if (!validas.length) rechazar('La sesión no contiene preguntas válidas', 409);

    const respuestas = sesion.respuestas || {};
    const aciertos = validas.filter(item => respuestas[item.id]?.correcto === true).length;
    const total = validas.length;
    const errores = total - aciertos;
    const porcentaje = Math.round((aciertos / total) * 100);
    const reglas = await almacen.leerConfig('reglas-gamificacion');
    const minimo = Number(reglas?.quiz?.porcentajeAprobacion);
    if (!Number.isFinite(minimo)) rechazar('El porcentaje de aprobación no está configurado', 500);
    const aprobado = porcentaje >= minimo;

    if (aprobado) {
      await actualizarNivelAprobado(req.usuario.id, sesion.temaId, Number(sesion.nivel));
    }

    const inicioMs = new Date(sesion.inicio || sesion.fecha || Date.now()).getTime();
    const duracionSeg = Math.max(0, Math.floor((Date.now() - inicioMs) / 1000));
    const resultado = await procesarIntento(req.usuario, {
      actividad: 'quiz',
      temaId: sesion.temaId,
      nivel: Number(sesion.nivel),
      puntaje: aciertos,
      maximo: total,
      errores,
      duracionSeg,
      detalle: { aprobado }
    });

    const repasar = validas
      .filter(item => respuestas[item.id]?.correcto !== true)
      .map(item => item.retroalimentacion)
      .filter(Boolean);
    await almacen.actualizar('quiz-sesiones', sesion.id, {
      finalizada: true,
      fin: new Date().toISOString(),
      resultado: { porcentaje, aprobado, aciertos, total }
    });

    res.json({
      porcentaje,
      aprobado,
      aciertos,
      total,
      repasar,
      puntosGanados: resultado.puntosGanados,
      insigniasNuevas: resultado.insigniasNuevas
    });
  } catch (error) {
    if (error.estado) return res.status(error.estado).json({ error: error.message });
    next(error);
  }
});

export default router;
