// publico/js/nucleo/avatar.js · Canelo, asistente de navegación y tutor socrático
import { ia, listar } from './api.js';
import { MENU } from './menu.js';
import { usuarioActual } from './sesion.js';

const CLAVE_VOZ = 'avatarGuiaVoz';
const CLAVE_MODO = 'caneloModo';
const ESTADOS = ['reposo', 'hablando', 'pensando', 'celebrando'];
const PALABRAS_CLINICAS = [
  'paciente', 'paramedico', 'doctor', 'medico', 'trauma', 'shock', 'rcp',
  'xabcde', 'hemorragia', 'oxigeno', 'emergencia', 'prehospitalaria', 'clinica'
];

let avatar = null;
let estadoActual = 'reposo';
let vozActiva = localStorage.getItem(CLAVE_VOZ) !== 'false';
let ultimoTexto = '';
let historialTutor = [];
let enviando = false;
let globoTemporizador = null;

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dibujoAvatar() {
  return `<svg class="avatar-guia__svg" viewBox="0 0 160 180" role="img" aria-label="Canelo, asistente educativo">
    <defs><clipPath id="avatar-canelo-recorte"><circle cx="80" cy="90" r="68"/></clipPath></defs>
    <circle class="avatar-guia__marco" cx="80" cy="90" r="72"/>
    <image class="avatar-guia__canelo" href="/recursos/tutor-socratico.png" x="12" y="22" width="136" height="136" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar-canelo-recorte)"/>
  </svg>`;
}

function temaDesdePagina() {
  const parametros = new URLSearchParams(window.location.search);
  if (parametros.get('temaId')) return parametros.get('temaId');
  return window.location.pathname.endsWith('/tema.html') ? parametros.get('id') : '';
}

function menuVisible() {
  const usuario = usuarioActual();
  return MENU.filter(item => {
    if (!item.roles || item.roles.includes('publico')) return true;
    if (!usuario) return false;
    if (item.roles.includes('sesion')) return true;
    return item.roles.includes(usuario.rol);
  });
}

function agregarMensaje(rol, texto, enlace = null) {
  const historial = avatar?.querySelector('.canelo-chat__historial');
  if (!historial) return;

  const mensaje = document.createElement('div');
  mensaje.className = `canelo-chat__mensaje canelo-chat__mensaje--${rol}`;
  const nombre = document.createElement('strong');
  nombre.textContent = rol === 'usuario' ? 'Tú' : 'Canelo';
  const contenido = document.createElement('p');
  contenido.textContent = String(texto || '');
  mensaje.append(nombre, contenido);

  if (enlace?.href && enlace?.texto) {
    const vinculo = document.createElement('a');
    vinculo.className = 'canelo-chat__enlace';
    vinculo.href = enlace.href;
    vinculo.textContent = enlace.texto;
    mensaje.appendChild(vinculo);
  }

  historial.appendChild(mensaje);
  historial.scrollTop = historial.scrollHeight;
}

function bienvenida() {
  if (avatar?.querySelector('.canelo-chat__mensaje')) return;
  agregarMensaje(
    'canelo',
    'Hola, soy Canelo. Puedo ayudarte a encontrar secciones del ecosistema o acompañarte con preguntas socráticas sobre un tema paramédico.'
  );
}

function abrirChat() {
  if (!avatar) return;
  const panel = avatar.querySelector('.canelo-chat');
  const lanzador = avatar.querySelector('.avatar-guia__lanzador');
  panel.hidden = false;
  lanzador.setAttribute('aria-expanded', 'true');
  avatar.querySelector('.avatar-guia__globo').hidden = true;
  bienvenida();
  panel.querySelector('.canelo-chat__entrada').focus();
}

function cerrarChat() {
  if (!avatar) return;
  avatar.querySelector('.canelo-chat').hidden = true;
  const lanzador = avatar.querySelector('.avatar-guia__lanzador');
  lanzador.setAttribute('aria-expanded', 'false');
  lanzador.focus();
}

function actualizarModo(anunciar = false) {
  const modo = avatar.querySelector('#canelo-modo').value;
  const grupoTema = avatar.querySelector('.canelo-chat__tema');
  const entrada = avatar.querySelector('.canelo-chat__entrada');
  grupoTema.hidden = modo !== 'tutor';
  entrada.placeholder = modo === 'tutor'
    ? 'Responde o plantea una duda sobre el tema…'
    : 'Pregunta cómo encontrar una sección…';
  localStorage.setItem(CLAVE_MODO, modo);

  if (!anunciar) return;
  if (modo === 'tutor') {
    agregarMensaje(
      'canelo',
      usuarioActual()
        ? 'Selecciona un tema. Te orientaré con una pregunta por turno para que construyas la respuesta.'
        : 'Para usar la tutoría socrática debes iniciar sesión. La ayuda de navegación sigue disponible.',
      usuarioActual() ? null : { href: '/paginas/ingreso.html', texto: 'Iniciar sesión' }
    );
  } else {
    agregarMensaje('canelo', 'Pregúntame dónde encontrar una opción o cómo moverte dentro del ecosistema.');
  }
}

async function cargarTemas() {
  const selector = avatar?.querySelector('#canelo-tema');
  if (!selector) return;

  if (!usuarioActual()) {
    selector.innerHTML = '<option value="">Inicia sesión para elegir un tema</option>';
    selector.disabled = true;
    return;
  }

  try {
    const respuesta = await listar('temas');
    const temas = (Array.isArray(respuesta) ? respuesta : [])
      .filter(tema => tema.estado === 'publicado')
      .sort((a, b) => String(a.titulo).localeCompare(String(b.titulo), 'es'));

    selector.innerHTML = temas.length
      ? `<option value="">Selecciona un tema</option>${temas.map(tema => {
          const opcion = document.createElement('option');
          opcion.value = tema.id;
          opcion.textContent = tema.titulo;
          return opcion.outerHTML;
        }).join('')}`
      : '<option value="">No hay temas publicados disponibles</option>';
    selector.disabled = temas.length === 0;

    const temaPagina = temaDesdePagina();
    if (temaPagina && temas.some(tema => String(tema.id) === String(temaPagina))) {
      selector.value = temaPagina;
      avatar.querySelector('#canelo-modo').value = 'tutor';
      actualizarModo(false);
    }
  } catch {
    selector.innerHTML = '<option value="">No fue posible cargar los temas</option>';
    selector.disabled = true;
  }
}

function coincidenciaMenu(consulta) {
  const texto = normalizar(consulta);
  const palabrasIgnoradas = new Set(['como', 'donde', 'esta', 'puedo', 'quiero', 'para', 'mis', 'las', 'los', 'una', 'del']);
  let mejor = null;
  let puntuacionMejor = 0;

  for (const item of menuVisible()) {
    const nombre = normalizar(item.texto);
    const palabras = nombre.split(' ').filter(palabra => !palabrasIgnoradas.has(palabra));
    let puntuacion = texto.includes(nombre) ? 10 : 0;
    puntuacion += palabras.filter(palabra => palabra.length > 2 && texto.includes(palabra)).length;
    if (puntuacion > puntuacionMejor) {
      mejor = item;
      puntuacionMejor = puntuacion;
    }
  }
  return puntuacionMejor > 0 ? mejor : null;
}

function responderNavegacion(consulta) {
  const texto = normalizar(consulta);
  const esClinica = PALABRAS_CLINICAS.some(palabra => texto.includes(palabra));
  if (esClinica || texto.includes('socratic')) {
    avatar.querySelector('#canelo-modo').value = 'tutor';
    actualizarModo(false);
    agregarMensaje(
      'canelo',
      usuarioActual()
        ? 'He cambiado al modo Tutor socrático. Elige un tema publicado para comenzar; trabajaré solo con ese contenido autorizado.'
        : 'Las preguntas paramédicas se trabajan en modo Tutor socrático y requieren iniciar sesión.',
      usuarioActual() ? null : { href: '/paginas/ingreso.html', texto: 'Iniciar sesión' }
    );
    return;
  }

  if (texto.includes('tutor')) {
    const sesion = usuarioActual();
    agregarMensaje(
      'canelo',
      sesion
        ? 'El Tutor IA se abre desde un tema o desde Actividades. Allí eliges el contenido y Canelo te guía sin darte directamente la solución.'
        : 'Para usar el Tutor IA debes iniciar sesión. Luego podrás elegir un tema publicado y razonar mediante preguntas guía.',
      sesion
        ? { href: '/paginas/actividades.html', texto: 'Ir a Actividades' }
        : { href: '/paginas/ingreso.html', texto: 'Iniciar sesión' }
    );
    return;
  }

  const item = coincidenciaMenu(consulta);
  if (item) {
    agregarMensaje(
      'canelo',
      `Encontrarás “${item.texto}” en el menú lateral de navegación. También puedes abrirlo desde este enlace.`,
      { href: item.href, texto: `Ir a ${item.texto}` }
    );
    return;
  }

  const opciones = menuVisible().slice(0, 6).map(itemMenu => itemMenu.texto).join(', ');
  agregarMensaje('canelo', `Puedo orientarte hacia opciones como ${opciones}. Escribe el nombre de la sección que buscas.`);
}

function cambiarEnvio(activo) {
  enviando = activo;
  cambiarEstado(activo ? 'pensando' : 'reposo');
  cambiarEstado(activo ? 'pensando' : 'reposo');
  const estado = avatar.querySelector('.canelo-chat__estado');
  const entrada = avatar.querySelector('.canelo-chat__entrada');
  const boton = avatar.querySelector('.canelo-chat__enviar');
  estado.hidden = !activo;
  entrada.disabled = activo;
  boton.disabled = activo;
}

async function responderTutor(consulta) {
  const usuario = usuarioActual();
  const temaId = avatar.querySelector('#canelo-tema').value;
  if (!usuario) {
    agregarMensaje('canelo', 'Inicia sesión para usar la tutoría socrática.', { href: '/paginas/ingreso.html', texto: 'Iniciar sesión' });
    return;
  }
  if (!temaId) {
    agregarMensaje('canelo', 'Primero selecciona el tema paramédico que deseas estudiar.');
    avatar.querySelector('#canelo-tema').focus();
    return;
  }

  historialTutor.push({ rol: 'estudiante', texto: consulta });
  cambiarEnvio(true);
  try {
    const resultado = await ia('tutor', {
      temaId,
      historial: historialTutor.slice(-10),
      permitirRevision: false
    });
    const respuesta = resultado?.respuesta || 'No pude formular una orientación en este momento.';
    historialTutor.push({ rol: 'tutor', texto: respuesta });
    agregarMensaje('canelo', respuesta);
    decir(respuesta);
  } catch (error) {
    const mensaje = error.estado === 429
      ? 'Alcanzaste el límite diario del tutor. Podrás continuar mañana.'
      : 'No pude consultar el tutor en este momento. Inténtalo nuevamente en unos minutos.';
    agregarMensaje('canelo', mensaje);
  } finally {
    cambiarEnvio(false);
  }
}

async function enviarConsulta(texto) {
  const consulta = String(texto || '').trim();
  if (!consulta || enviando) return;
  agregarMensaje('usuario', consulta);
  const entrada = avatar.querySelector('.canelo-chat__entrada');
  entrada.value = '';

  if (avatar.querySelector('#canelo-modo').value === 'tutor') {
    await responderTutor(consulta);
  } else {
    responderNavegacion(consulta);
  }
  entrada.focus();
}

function alternarVoz() {
  vozActiva = !vozActiva;
  localStorage.setItem(CLAVE_VOZ, String(vozActiva));
  avatar.querySelector('.avatar-guia__voz').textContent = vozActiva ? 'Silenciar voz' : 'Activar voz';
  if (!vozActiva && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

function vozEspanol() {
  return window.speechSynthesis.getVoices().find(voz => /^es([-_]|$)/i.test(voz.lang));
}

export function montarAvatar() {
  if (avatar?.isConnected) return avatar;

  avatar = document.createElement('aside');
  avatar.className = `avatar-guia avatar-guia--${estadoActual}`;
  avatar.setAttribute('aria-label', 'Canelo, asistente educativo');
  avatar.innerHTML = `
    <div class="avatar-guia__globo" role="status" aria-live="polite" hidden></div>
    <section id="canelo-chat" class="canelo-chat" role="dialog" aria-label="Chat con Canelo" hidden>
      <header class="canelo-chat__cabecera">
        <div class="canelo-chat__cabecera-identidad">
          <img src="/recursos/tutor-socratico.png" alt="" class="canelo-chat__retrato">
          <div><h2>Canelo</h2><p>Asistente educativo</p></div>
        </div>
        <button type="button" class="canelo-chat__cerrar" aria-label="Minimizar chat">−</button>
      </header>
      <div class="canelo-chat__controles">
        <div class="campo">
          <label for="canelo-modo">Tipo de ayuda</label>
          <select id="canelo-modo">
            <option value="navegacion">Navegación del ecosistema</option>
            <option value="tutor">Tutor socrático paramédico</option>
          </select>
        </div>
        <div class="campo canelo-chat__tema" hidden>
          <label for="canelo-tema">Tema autorizado</label>
          <select id="canelo-tema"><option value="">Cargando temas…</option></select>
        </div>
      </div>
      <div class="canelo-chat__historial" role="log" aria-live="polite" aria-relevant="additions"></div>
      <div class="canelo-chat__atajos" aria-label="Preguntas sugeridas">
        <button type="button" data-consulta="¿Dónde encuentro mis asignaturas?">Mis asignaturas</button>
        <button type="button" data-consulta="¿Cómo uso el tutor?">Usar el tutor</button>
        <button type="button" data-activar-tutor="true">Practicar tema paramédico</button>
      </div>
      <p class="canelo-chat__estado" role="status" hidden>Canelo está pensando…</p>
      <form class="canelo-chat__formulario">
        <label class="sr-only" for="canelo-entrada">Escribe tu pregunta</label>
        <textarea id="canelo-entrada" class="canelo-chat__entrada" rows="2" maxlength="1000" required></textarea>
        <button type="submit" class="btn btn--primario canelo-chat__enviar">Enviar</button>
      </form>
      <footer class="canelo-chat__pie">
        <small>Uso educativo: no reemplaza valoración profesional ni protocolos locales.</small>
        <button type="button" class="avatar-guia__voz">${vozActiva ? 'Silenciar voz' : 'Activar voz'}</button>
      </footer>
    </section>
    <button type="button" class="avatar-guia__lanzador" aria-controls="canelo-chat" aria-expanded="false">
      ${dibujoAvatar()}
      <span>Pregunta a Canelo</span>
    </button>
  `;
  document.body.appendChild(avatar);

  const modoGuardado = localStorage.getItem(CLAVE_MODO);
  avatar.querySelector('#canelo-modo').value = ['navegacion', 'tutor'].includes(modoGuardado) ? modoGuardado : 'navegacion';
  actualizarModo(false);
  cargarTemas();

  avatar.querySelector('.avatar-guia__lanzador').addEventListener('click', abrirChat);
  avatar.querySelector('.canelo-chat__cerrar').addEventListener('click', cerrarChat);
  avatar.querySelector('.avatar-guia__voz').addEventListener('click', alternarVoz);
  avatar.querySelector('#canelo-modo').addEventListener('change', () => actualizarModo(true));
  avatar.querySelector('#canelo-tema').addEventListener('change', evento => {
    historialTutor = [];
    const opcion = evento.target.selectedOptions[0];
    if (evento.target.value && opcion) agregarMensaje('canelo', `Trabajaremos el tema “${opcion.textContent}”. ¿Qué idea deseas analizar primero?`);
  });
  avatar.querySelector('.canelo-chat__formulario').addEventListener('submit', evento => {
    evento.preventDefault();
    enviarConsulta(avatar.querySelector('.canelo-chat__entrada').value);
  });
  avatar.querySelector('.canelo-chat__entrada').addEventListener('keydown', evento => {
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault();
      evento.currentTarget.form.requestSubmit();
    }
  });
  avatar.querySelector('.canelo-chat__atajos').addEventListener('click', evento => {
    const boton = evento.target.closest('button');
    if (!boton) return;
    if (boton.dataset.activarTutor) {
      avatar.querySelector('#canelo-modo').value = 'tutor';
      actualizarModo(true);
      avatar.querySelector('#canelo-tema').focus();
      return;
    }
    enviarConsulta(boton.dataset.consulta);
  });
  document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && !avatar.querySelector('.canelo-chat').hidden) cerrarChat();
  });
  return avatar;
}

export function decir(texto) {
  ultimoTexto = String(texto || '');
  const elemento = montarAvatar();
  if (!elemento) return;

  const globo = elemento.querySelector('.avatar-guia__globo');
  if (elemento.querySelector('.canelo-chat').hidden && ultimoTexto) {
    globo.textContent = ultimoTexto.slice(0, 180);
    globo.hidden = false;
    clearTimeout(globoTemporizador);
    globoTemporizador = setTimeout(() => { globo.hidden = true; }, 7000);
  }
  if (!vozActiva || !ultimoTexto || !('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();
  const mensaje = new SpeechSynthesisUtterance(ultimoTexto);
  mensaje.lang = 'es-EC';
  mensaje.voice = vozEspanol() || null;
  mensaje.addEventListener('start', () => cambiarEstado('hablando'));
  mensaje.addEventListener('end', () => cambiarEstado('reposo'));
  mensaje.addEventListener('error', () => cambiarEstado('reposo'));
  window.speechSynthesis.speak(mensaje);
}

export function cambiarEstado(estado) {
  estadoActual = ESTADOS.includes(estado) ? estado : 'reposo';
  if (!avatar?.isConnected) return;
  avatar.classList.remove(...ESTADOS.map(item => `avatar-guia--${item}`));
  avatar.classList.add(`avatar-guia--${estadoActual}`);
}

export default { montarAvatar, decir, cambiarEstado };
