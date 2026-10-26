// publico/js/modulos/quiz.js · Interfaz del quiz progresivo por niveles
import { montarPlantilla } from '../nucleo/plantilla.js';
import { llamar } from '../nucleo/api.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { mostrarLogros } from '../nucleo/gamificacion.js';
import { generarDiploma } from '../nucleo/pdf.js';
import { aviso, cargando, escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Quiz por niveles', roles: ['estudiante'] });

const contenido = document.getElementById('contenido');
let tema = null;
let niveles = [];
let nivelActual = null;
let sesionId = '';
let preguntas = [];
let indicePregunta = 0;

function nombreEstado(estado) {
  return estado === 'aprobado' ? 'Aprobado' : estado === 'disponible' ? 'Disponible' : 'Bloqueado';
}

function claseEstado(estado) {
  if (estado === 'aprobado') return 'insignia--exito';
  if (estado === 'disponible') return 'insignia--info';
  return 'insignia--advertencia';
}

async function cargarEstado() {
  cargando(true);
  try {
    const estado = await llamar('GET', `/api/quiz/estado?temaId=${encodeURIComponent(tema.id)}`);
    niveles = Array.isArray(estado?.niveles) ? estado.niveles : [];
    renderizarNiveles();
  } catch (error) {
    aviso(error.message || 'No se pudo cargar el estado del quiz.', 'error');
    contenido.innerHTML = '<div class="vacio"><h1 class="vacio__titulo">No se pudo abrir el quiz</h1><p class="vacio__texto">Intenta nuevamente en unos minutos.</p></div>';
  } finally {
    cargando(false);
  }
}

function renderizarNiveles() {
  contenido.innerHTML = `
    <div class="quiz-layout">
      <header class="quiz-cabecera">
        <div>
          <h1>Quiz por niveles</h1>
          <p>${escapar(tema.titulo)}</p>
        </div>
        <a class="btn btn--secundario" href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}">Repasar tema</a>
      </header>

      <section class="quiz-niveles" aria-label="Niveles cognitivos">
        ${niveles.map(item => `
          <button type="button"
            class="quiz-nivel quiz-nivel--${escapar(item.estado)}"
            data-nivel="${item.nivel}"
            ${item.estado === 'bloqueado' ? 'disabled' : ''}
            aria-label="Nivel ${item.nivel}, ${escapar(item.nombre)}, ${nombreEstado(item.estado)}">
            <span class="quiz-nivel__numero">Nivel ${item.nivel}</span>
            <span class="quiz-nivel__nombre">${escapar(item.nombre)}</span>
            <span class="insignia ${claseEstado(item.estado)}">${nombreEstado(item.estado)}</span>
            <span class="quiz-nivel__porcentaje">Mejor resultado: ${Number(item.mejorPorcentaje) || 0}%</span>
          </button>`).join('')}
      </section>

      <section class="tarjeta" aria-labelledby="ayuda-niveles">
        <h2 id="ayuda-niveles" class="tarjeta__titulo">¿Cómo avanzar?</h2>
        <p class="tarjeta__subtitulo">Aprueba cada nivel para desbloquear el siguiente. Puedes repetir los niveles aprobados para mejorar tu porcentaje.</p>
      </section>
    </div>`;

  contenido.querySelectorAll('[data-nivel]').forEach(boton => boton.addEventListener('click', () => {
    iniciarNivel(Number(boton.dataset.nivel));
  }));
}

async function iniciarNivel(nivel) {
  cargando(true);
  try {
    const resultado = await llamar('POST', '/api/quiz/iniciar', { temaId: tema.id, nivel });
    nivelActual = nivel;
    sesionId = resultado.sesionId;
    preguntas = Array.isArray(resultado.preguntas) ? resultado.preguntas : [];
    indicePregunta = 0;
    if (!sesionId || !preguntas.length) throw new Error('El nivel no contiene preguntas disponibles.');
    renderizarPregunta();
  } catch (error) {
    aviso(error.message || 'No se pudo iniciar el nivel.', 'error');
  } finally {
    cargando(false);
  }
}

function renderizarPregunta() {
  const pregunta = preguntas[indicePregunta];
  const numero = indicePregunta + 1;
  contenido.innerHTML = `
    <div class="quiz-layout">
      <header class="quiz-cabecera">
        <div><h1>Nivel ${nivelActual}</h1><p>${escapar(tema.titulo)}</p></div>
        <button type="button" class="btn btn--texto" id="btn-salir-quiz">Salir del nivel</button>
      </header>

      <section class="tarjeta quiz-pregunta" aria-labelledby="quiz-enunciado">
        <div class="quiz-pregunta__cabecera">
          <span class="insignia insignia--info">Pregunta ${numero} de ${preguntas.length}</span>
          <span>${Math.round((numero / preguntas.length) * 100)}%</span>
        </div>
        <progress class="quiz-progreso" value="${numero}" max="${preguntas.length}" aria-label="Progreso del nivel"></progress>
        <h2 class="quiz-enunciado" id="quiz-enunciado">${escapar(pregunta.enunciado)}</h2>
        <form id="form-respuesta" novalidate>${controlesRespuesta(pregunta)}</form>
        <div class="quiz-retro" id="quiz-retro"></div>
        <div class="quiz-acciones">
          <button type="button" class="btn btn--primario" id="btn-responder">Responder</button>
          <button type="button" class="btn btn--primario" id="btn-siguiente" hidden>${numero === preguntas.length ? 'Ver resultado' : 'Siguiente'}</button>
        </div>
      </section>
    </div>`;

  let seleccionVF = null;
  contenido.querySelectorAll('[data-vf]').forEach(boton => boton.addEventListener('click', () => {
    seleccionVF = boton.dataset.vf === 'true';
    contenido.querySelectorAll('[data-vf]').forEach(item => item.setAttribute('aria-pressed', String(item === boton)));
  }));

  document.getElementById('btn-salir-quiz').addEventListener('click', cargarEstado);
  document.getElementById('btn-responder').addEventListener('click', async () => {
    const respuesta = leerRespuesta(pregunta, seleccionVF);
    if (respuesta === undefined || respuesta === '') {
      aviso('Selecciona o escribe una respuesta antes de continuar.', 'error');
      return;
    }
    await responderPregunta(pregunta, respuesta);
  });
  document.getElementById('btn-siguiente').addEventListener('click', async () => {
    indicePregunta++;
    if (indicePregunta < preguntas.length) renderizarPregunta();
    else await finalizarNivel();
  });
}

function controlesRespuesta(pregunta) {
  if (pregunta.tipo === 'opcion') {
    return `
      <fieldset class="quiz-opciones">
        <legend class="sr-only">Selecciona una respuesta</legend>
        ${(pregunta.opciones || []).map((opcion, indice) => `
          <label class="quiz-opcion">
            <input type="radio" name="respuesta" value="${indice}">
            <span>${escapar(opcion)}</span>
          </label>`).join('')}
      </fieldset>`;
  }
  if (pregunta.tipo === 'vf') {
    return `
      <div class="quiz-vf" role="group" aria-label="Selecciona verdadero o falso">
        <button type="button" class="quiz-vf__boton" data-vf="true" aria-pressed="false">Verdadero</button>
        <button type="button" class="quiz-vf__boton" data-vf="false" aria-pressed="false">Falso</button>
      </div>`;
  }
  return `
    <div class="campo quiz-completar">
      <label for="respuesta-completar">Completa el espacio en blanco</label>
      <input type="text" id="respuesta-completar" autocomplete="off" required>
    </div>`;
}

function leerRespuesta(pregunta, seleccionVF) {
  if (pregunta.tipo === 'opcion') {
    const elegida = contenido.querySelector('input[name="respuesta"]:checked');
    return elegida ? Number(elegida.value) : undefined;
  }
  if (pregunta.tipo === 'vf') return seleccionVF;
  return contenido.querySelector('#respuesta-completar')?.value.trim();
}

async function responderPregunta(pregunta, respuesta) {
  const botonResponder = document.getElementById('btn-responder');
  botonResponder.disabled = true;
  cargando(true);
  try {
    const resultado = await llamar('POST', '/api/quiz/responder', {
      sesionId,
      preguntaId: pregunta.id,
      respuesta
    });
    contenido.querySelectorAll('#form-respuesta input, #form-respuesta button').forEach(control => { control.disabled = true; });
    mostrarRetro({
      correcto: resultado.correcto,
      explicacion: resultado.retroalimentacion,
      sugerencia: resultado.correcto ? 'Continúa con la siguiente pregunta.' : `Respuesta correcta: ${resultado.correcta}`,
      enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(tema.id)}`,
      contenedor: document.getElementById('quiz-retro')
    });
    botonResponder.hidden = true;
    document.getElementById('btn-siguiente').hidden = false;
    document.getElementById('btn-siguiente').focus();
  } catch (error) {
    botonResponder.disabled = false;
    aviso(error.message || 'No se pudo registrar la respuesta.', 'error');
  } finally {
    cargando(false);
  }
}

async function finalizarNivel() {
  cargando(true);
  let resultado;
  try {
    resultado = await llamar('POST', '/api/quiz/finalizar', { sesionId });
  } catch (error) {
    aviso(error.message || 'No se pudo finalizar el nivel.', 'error');
    indicePregunta = preguntas.length - 1;
    return;
  } finally {
    cargando(false);
  }

  renderizarResultado(resultado);
  if (resultado.aprobado) await mostrarLogros(resultado);
  const accion = await mostrarResumen({
    titulo: `${resultado.aprobado ? 'Nivel aprobado' : 'Nivel por reforzar'} · ${resultado.porcentaje}%`,
    aciertos: resultado.aciertos,
    errores: resultado.total - resultado.aciertos,
    recomendaciones: resultado.repasar?.length ? resultado.repasar : 'Continúa practicando para consolidar este nivel.',
    enlaceTema: resultado.aprobado ? undefined : `/paginas/tema.html?id=${encodeURIComponent(tema.id)}`
  });
  if (accion === 'repetir') await iniciarNivel(nivelActual);
}

function renderizarResultado(resultado) {
  contenido.innerHTML = `
    <section class="tarjeta quiz-resultado" aria-live="polite">
      <span class="insignia ${resultado.aprobado ? 'insignia--exito' : 'insignia--advertencia'}">${resultado.aprobado ? 'Nivel aprobado' : 'Sigue practicando'}</span>
      <span class="quiz-resultado__porcentaje">${resultado.porcentaje}%</span>
      <h2>${resultado.aciertos} de ${resultado.total} respuestas correctas</h2>
      <p>${resultado.aprobado ? 'Has desbloqueado el siguiente nivel y puedes descargar tu diploma.' : 'Repasa las recomendaciones y vuelve a intentarlo con nuevas preguntas.'}</p>
      <div class="quiz-resultado__acciones">
        <button type="button" class="btn btn--secundario" id="btn-volver-niveles">Ver niveles</button>
        <button type="button" class="btn btn--primario" id="btn-reintentar">${resultado.aprobado ? 'Practicar otra vez' : 'Reintentar'}</button>
        ${resultado.aprobado ? '<button type="button" class="btn btn--acento" id="btn-diploma">Descargar diploma</button>' : ''}
      </div>
    </section>`;

  document.getElementById('btn-volver-niveles').addEventListener('click', cargarEstado);
  document.getElementById('btn-reintentar').addEventListener('click', () => iniciarNivel(nivelActual));
  document.getElementById('btn-diploma')?.addEventListener('click', async event => {
    event.currentTarget.disabled = true;
    cargando(true);
    try {
      await generarDiploma({ tipo: 'nivel-quiz', temaId: tema.id, nivel: nivelActual });
    } catch (error) {
      aviso(error.message || 'No se pudo descargar el diploma.', 'error');
    } finally {
      event.currentTarget.disabled = false;
      cargando(false);
    }
  });
}

async function iniciar() {
  try {
    tema = await obtenerTemaActividad();
    if (!tema) {
      contenido.innerHTML = '<div class="vacio"><h1 class="vacio__titulo">Selecciona un tema</h1><p class="vacio__texto">Necesitas un tema publicado para comenzar el quiz.</p></div>';
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('temaId', tema.id);
    window.history.replaceState({}, '', url);
    await cargarEstado();
  } catch (error) {
    aviso(error.message || 'No se pudo iniciar el quiz.', 'error');
  }
}

await iniciar();
