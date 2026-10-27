// publico/js/modulos/tutor.js · Interfaz del tutor socrático
import { montarPlantilla } from '../nucleo/plantilla.js';
import { ia, llamar } from '../nucleo/api.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { escapar, confirmar, aviso } from '../nucleo/ui.js';
import { formatoBasico } from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { cambiarEstado, decir } from '../nucleo/avatar.js';

await montarPlantilla({ titulo: 'Tutor IA', roles: ['estudiante'] });

const tituloTemaEl = document.getElementById('titulo-tema');
const preguntasEl = document.getElementById('preguntas-guia');
const historialEl = document.getElementById('historial-tutor');
const pensandoEl = document.getElementById('tutor-pensando');
const formEl = document.getElementById('form-tutor');
const mensajeEl = document.getElementById('mensaje-tutor');
const enviarEl = formEl.querySelector('[type="submit"]');
const nuevaEl = document.getElementById('btn-nueva');
const permitirRevisionEl = document.getElementById('permitir-revision-tutor');
const borrarHistorialEl = document.getElementById('btn-borrar-historial-tutor');
const usuario = usuarioActual();

let tema = null;
let historial = [];
let enviando = false;

function preguntasIniciales(temaActual) {
  const preguntas = [];
  const agregar = pregunta => {
    if (pregunta && !preguntas.includes(pregunta) && preguntas.length < 3) preguntas.push(pregunta);
  };
  (temaActual.preguntasGuia || []).forEach(agregar);
  for (const objetivo of temaActual.objetivos || []) {
    if (preguntas.length >= 3) break;
    agregar(`¿Cómo explicarías este objetivo con tus palabras: ${objetivo}?`);
  }
  const alternativas = [
    `¿Cuál es la idea principal de ${temaActual.titulo}?`,
    `¿Cómo aplicarías ${temaActual.titulo} en una situación práctica?`,
    `¿Qué parte de ${temaActual.titulo} necesitas comprender mejor?`
  ];
  for (const pregunta of alternativas) {
    if (preguntas.length >= 3) break;
    agregar(pregunta);
  }
  return preguntas;
}

function bienvenida() {
  return `Soy **Canelo** y estoy listo para ayudarte a razonar sobre **${tema.titulo}**. Elige una pregunta guía o escribe tu duda.`;
}

function avatar(rol) {
  if (rol === 'tutor') {
    return '<img src="/recursos/tutor-socratico.png" alt="Canelo, tutor socrático" class="tutor__avatar">';
  }
  if (usuario?.foto) {
    return `<img src="${escapar(usuario.foto)}" alt="Tu foto de perfil" class="tutor__avatar">`;
  }
  const iniciales = [usuario?.nombre, usuario?.apellido]
    .filter(Boolean)
    .map(valor => String(valor).trim().charAt(0))
    .join('')
    .slice(0, 2)
    .toLocaleUpperCase('es');
  return `<span class="tutor__avatar tutor__avatar--iniciales" aria-label="Tu perfil">${escapar(iniciales || '?')}</span>`;
}

function burbuja(rol, texto) {
  const contenido = rol === 'tutor' ? formatoBasico(texto) : `<p>${escapar(texto)}</p>`;
  return `<div class="tutor__fila tutor__fila--${rol}">${avatar(rol)}<div class="tutor__burbuja">${contenido}</div></div>`;
}

function renderizarHistorial() {
  historialEl.innerHTML = [burbuja('tutor', bienvenida()), ...historial.map(item => burbuja(item.rol, item.texto))].join('');
  historialEl.scrollTop = historialEl.scrollHeight;
}

function cambiarEnvio(activo) {
  enviando = activo;
  if (activo) cambiarEstado('pensando');
  pensandoEl.hidden = !activo;
  enviarEl.disabled = activo;
  mensajeEl.disabled = activo;
  nuevaEl.disabled = activo;
  preguntasEl.querySelectorAll('button').forEach(boton => { boton.disabled = activo; });
  if (activo) historialEl.scrollTop = historialEl.scrollHeight;
}

async function enviar(texto) {
  const limpio = String(texto || '').trim();
  if (!limpio || enviando || !tema) return;
  historial.push({ rol: 'estudiante', texto: limpio });
  renderizarHistorial();
  mensajeEl.value = '';
  cambiarEnvio(true);
  try {
    const resultado = await ia('tutor', {
      temaId: tema.id,
      historial: historial.slice(-10),
      permitirRevision: permitirRevisionEl.checked
    });
    const respuesta = resultado?.respuesta || 'No pude formular una orientación en este momento.';
    historial.push({ rol: 'tutor', texto: respuesta });
    cambiarEstado('hablando');
    decir(respuesta);
    setTimeout(() => cambiarEstado('reposo'), 3000);
  } catch (error) {
    const limite = error.estado === 429 || /límite diario/i.test(error.message || '');
    historial.push({
      rol: 'tutor',
      texto: limite
        ? 'Has alcanzado el límite diario del tutor. Podemos continuar mañana con nuevas preguntas.'
        : 'No pude responder en este momento. Inténtalo nuevamente en unos minutos.'
    });
    cambiarEstado('reposo');
  } finally {
    cambiarEnvio(false);
    renderizarHistorial();
    mensajeEl.focus();
  }
}

function montarTema() {
  tituloTemaEl.textContent = tema.titulo;
  preguntasEl.innerHTML = preguntasIniciales(tema).map(pregunta =>
    `<button type="button" class="tutor__chip" data-pregunta="${escapar(pregunta)}">${escapar(pregunta)}</button>`
  ).join('');
  preguntasEl.querySelectorAll('[data-pregunta]').forEach(boton => {
    boton.addEventListener('click', () => enviar(boton.dataset.pregunta));
  });
  renderizarHistorial();
  mensajeEl.focus();
}

formEl.addEventListener('submit', evento => {
  evento.preventDefault();
  enviar(mensajeEl.value);
});

mensajeEl.addEventListener('keydown', evento => {
  if (evento.key === 'Enter' && !evento.shiftKey) {
    evento.preventDefault();
    formEl.requestSubmit();
  }
});

nuevaEl.addEventListener('click', () => {
  historial = [];
  renderizarHistorial();
  mensajeEl.value = '';
  mensajeEl.focus();
});

borrarHistorialEl.addEventListener('click', async () => {
  const aceptado = await confirmar('¿Deseas borrar definitivamente todo tu historial compartido con docentes y administradores?');
  if (!aceptado) return;
  borrarHistorialEl.disabled = true;
  try {
    const resultado = await llamar('DELETE', '/api/ia/tutor/historial');
    permitirRevisionEl.checked = false;
    aviso(`Historial compartido eliminado (${Number(resultado?.eliminados) || 0} registros).`, 'exito');
  } catch (error) {
    aviso(error.message || 'No se pudo borrar el historial compartido', 'error');
  } finally {
    borrarHistorialEl.disabled = false;
  }
});

try {
  tema = await obtenerTemaActividad();
  if (tema) {
    montarTema();
  } else {
    tituloTemaEl.textContent = 'Selecciona un tema para conversar';
    historialEl.innerHTML = '<div class="vacio"><p class="vacio__texto">No se seleccionó ningún tema.</p></div>';
    formEl.hidden = true;
    nuevaEl.hidden = true;
  }
} catch {
  tituloTemaEl.textContent = 'No se pudo cargar el tema';
  historialEl.innerHTML = '<div class="vacio"><p class="vacio__texto">Inténtalo nuevamente desde la página del tema.</p></div>';
  formEl.hidden = true;
}
