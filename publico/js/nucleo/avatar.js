// publico/js/nucleo/avatar.js · Avatar guía animado y accesible
const CLAVE_VOZ = 'avatarGuiaVoz';
const CLAVE_OCULTO = 'avatarGuiaOculto';
const ESTADOS = ['reposo', 'hablando', 'pensando', 'celebrando'];
let avatar = null;
let estadoActual = 'reposo';
let vozActiva = localStorage.getItem(CLAVE_VOZ) !== 'false';
let botonRestaurar = null;
let ultimoTexto = '';

function dibujoAvatar() {
  return `<svg class="avatar-guia__svg" viewBox="0 0 160 180" role="img" aria-label="Canelo, personaje guía">
    <defs><clipPath id="avatar-canelo-recorte"><circle cx="80" cy="90" r="68"/></clipPath></defs>
    <circle class="avatar-guia__marco" cx="80" cy="90" r="72"/>
    <image class="avatar-guia__canelo" href="/recursos/tutor-socratico.png" x="12" y="22" width="136" height="136" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar-canelo-recorte)"/>
  </svg>`;
}

export function montarAvatar() {
  if (avatar?.isConnected) return avatar;
  if (localStorage.getItem(CLAVE_OCULTO) === 'true') {
    montarBotonRestaurar();
    return null;
  }
  avatar = document.createElement('aside');
  avatar.className = `avatar-guia avatar-guia--${estadoActual}`;
  avatar.setAttribute('aria-label', 'Avatar guía');
  avatar.innerHTML = `<div class="avatar-guia__globo" role="status" aria-live="polite"></div>${dibujoAvatar()}<div class="avatar-guia__acciones"><button type="button" class="avatar-guia__voz">${vozActiva ? 'Silenciar' : 'Activar voz'}</button><button type="button" class="avatar-guia__ocultar">Ocultar</button></div>`;
  document.body.appendChild(avatar);
  avatar.querySelector('.avatar-guia__voz').addEventListener('click', alternarVoz);
  avatar.querySelector('.avatar-guia__ocultar').addEventListener('click', ocultar);
  return avatar;
}

function alternarVoz() {
  vozActiva = !vozActiva;
  localStorage.setItem(CLAVE_VOZ, String(vozActiva));
  avatar.querySelector('.avatar-guia__voz').textContent = vozActiva ? 'Silenciar' : 'Activar voz';
  if (!vozActiva && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

function ocultar() {
  localStorage.setItem(CLAVE_OCULTO, 'true');
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  avatar?.remove();
  avatar = null;
  montarBotonRestaurar();
}

function montarBotonRestaurar() {
  if (botonRestaurar?.isConnected) return;
  botonRestaurar = document.createElement('button');
  botonRestaurar.type = 'button';
  botonRestaurar.className = 'avatar-guia-restaurar';
  botonRestaurar.textContent = 'Mostrar Canelo';
  botonRestaurar.addEventListener('click', () => {
    localStorage.setItem(CLAVE_OCULTO, 'false');
    botonRestaurar.remove();
    botonRestaurar = null;
    const elemento = montarAvatar();
    if (elemento) elemento.querySelector('.avatar-guia__globo').textContent = ultimoTexto;
  });
  document.body.appendChild(botonRestaurar);
}

function vozEspanol() {
  return window.speechSynthesis.getVoices().find(voz => /^es([-_]|$)/i.test(voz.lang));
}

export function decir(texto) {
  ultimoTexto = String(texto || '');
  const elemento = montarAvatar();
  if (!elemento) return;
  elemento.querySelector('.avatar-guia__globo').textContent = ultimoTexto;
  if (!vozActiva || !texto || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const mensaje = new SpeechSynthesisUtterance(String(texto));
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
