// publico/js/modulos/mensajes.js · Bandeja y conversación privada
import { montarPlantilla } from '../nucleo/plantilla.js';
import { llamar, listar, crear } from '../nucleo/api.js';
import { usuarioActual } from '../nucleo/sesion.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Mensajes', roles: ['sesion'] });

const usuario = usuarioActual();
let perfilActual = usuario;
const bandeja = document.querySelector('.mensajes__bandeja');
const listaEl = document.getElementById('lista-conversaciones');
const buscarEl = document.getElementById('buscar-conversacion');
const historialEl = document.getElementById('historial-mensajes');
const tituloChatEl = document.getElementById('titulo-chat');
const rolContactoEl = document.getElementById('rol-contacto');
const formEl = document.getElementById('form-mensaje');
const textoEl = document.getElementById('texto-mensaje');
const contadorEl = document.getElementById('contador-texto');
const btnNuevaEl = document.getElementById('btn-nueva-conversacion');
const btnVolverEl = document.getElementById('btn-volver');
const btnDifusionEl = document.getElementById('btn-difusion');
const btnBloqueoEl = document.getElementById('btn-bloqueo');

btnDifusionEl.hidden = usuario.rol !== 'docente';

let conversaciones = [];
let conversacionActiva = null;
let mensajes = [];
let hayAnteriores = false;
let cargandoNuevos = false;

function nombreDe(contacto) {
  return contacto ? `${contacto.nombre || ''} ${contacto.apellido || ''}`.trim() : 'Usuario no disponible';
}

function inicialesDe(persona) {
  return [persona?.nombre, persona?.apellido]
    .filter(Boolean)
    .map(valor => String(valor).trim().charAt(0))
    .join('')
    .slice(0, 2)
    .toLocaleUpperCase('es');
}

function avatarDe(persona, clase = '') {
  const nombre = nombreDe(persona);
  if (persona?.foto) {
    return `<img src="${ui.escapar(persona.foto)}" alt="Foto de ${ui.escapar(nombre)}" class="mensajes__avatar ${clase}">`;
  }
  return `<span class="mensajes__avatar mensajes__avatar--iniciales ${clase}" aria-label="${ui.escapar(nombre)}">${ui.escapar(inicialesDe(persona) || '?')}</span>`;
}

function horaCorta(fecha) {
  if (!fecha) return '';
  return new Intl.DateTimeFormat('es-EC', { hour: '2-digit', minute: '2-digit' }).format(new Date(fecha));
}

function diaClave(fecha) {
  const valor = new Date(fecha);
  return `${valor.getFullYear()}-${valor.getMonth()}-${valor.getDate()}`;
}

function diaTexto(fecha) {
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'long' }).format(new Date(fecha));
}

function textoConEnlaces(texto) {
  const patron = /https?:\/\/[^\s]+/gi;
  let posicion = 0;
  let html = '';
  for (const coincidencia of String(texto || '').matchAll(patron)) {
    html += ui.escapar(String(texto).slice(posicion, coincidencia.index));
    const url = coincidencia[0];
    html += `<a href="${ui.escapar(url)}" rel="noopener" target="_blank">${ui.escapar(url)}</a>`;
    posicion = coincidencia.index + url.length;
  }
  return html + ui.escapar(String(texto || '').slice(posicion));
}

function actualizarEstadoChat() {
  if (!conversacionActiva) return;
  const bloqueada = conversacionActiva.bloqueadoPorMi || conversacionActiva.bloqueadoPorContacto;
  btnBloqueoEl.hidden = false;
  btnBloqueoEl.textContent = conversacionActiva.bloqueadoPorMi ? 'Desbloquear' : 'Bloquear';
  textoEl.disabled = bloqueada;
  formEl.querySelector('[type="submit"]').disabled = bloqueada;
  textoEl.placeholder = bloqueada ? 'No se pueden enviar mensajes mientras exista un bloqueo.' : 'Escribe un mensaje...';
}

function renderizarConversaciones() {
  const consulta = buscarEl.value.trim().toLocaleLowerCase('es');
  const visibles = conversaciones.filter(item => {
    const contenido = `${nombreDe(item.otro)} ${item.ultimo?.texto || ''}`.toLocaleLowerCase('es');
    return !consulta || contenido.includes(consulta);
  });

  if (!visibles.length) {
    listaEl.innerHTML = '<div class="vacio"><p class="vacio__texto">No hay conversaciones para mostrar.</p></div>';
    return;
  }

  listaEl.innerHTML = visibles.map(item => {
    const activa = conversacionActiva?.id === item.id ? ' mensajes__conversacion--activa' : '';
    const noLeidos = Number(item.noLeidos) || 0;
    return `
      <button type="button" class="mensajes__conversacion${activa}" data-id="${ui.escapar(item.id)}">
        ${avatarDe(item.otro, 'mensajes__avatar--bandeja')}
        <span class="mensajes__conversacion-contenido">
          <span class="mensajes__conversacion-superior">
            <span class="mensajes__conversacion-nombre">${ui.escapar(nombreDe(item.otro))}</span>
            <span class="mensajes__conversacion-hora">${ui.escapar(horaCorta(item.ultimo?.fecha || item.fecha))}</span>
          </span>
          <span class="mensajes__conversacion-superior">
            <span class="mensajes__conversacion-ultimo">${ui.escapar(item.ultimo?.texto || 'Sin mensajes todavía')}</span>
            ${noLeidos ? `<span class="insignia insignia--acento" aria-label="${noLeidos} mensajes no leídos">${noLeidos > 99 ? '99+' : noLeidos}</span>` : ''}
          </span>
        </span>
      </button>`;
  }).join('');

  listaEl.querySelectorAll('[data-id]').forEach(boton => {
    boton.addEventListener('click', () => abrirConversacion(boton.dataset.id));
  });
}

function renderizarMensajes({ mantenerPosicion = false } = {}) {
  if (!conversacionActiva) return;
  const alturaAnterior = historialEl.scrollHeight;
  const desplazamientoAnterior = historialEl.scrollTop;
  let diaAnterior = '';
  const bloques = mensajes.map(mensaje => {
    const clave = diaClave(mensaje.fecha);
    const separador = clave !== diaAnterior
      ? `<div class="mensajes__dia"><span>${ui.escapar(diaTexto(mensaje.fecha))}</span></div>`
      : '';
    diaAnterior = clave;
    const propio = String(mensaje.autorId) === String(usuario.id);
    const autor = propio ? perfilActual : conversacionActiva.otro;
    return `${separador}
      <div class="mensajes__fila-mensaje${propio ? ' mensajes__fila-mensaje--propio' : ''}" data-mensaje-id="${ui.escapar(mensaje.id)}">
        ${avatarDe(autor)}
        <div class="mensajes__burbuja">
          <p>${textoConEnlaces(mensaje.texto)}</p>
          <span class="mensajes__hora">${ui.escapar(horaCorta(mensaje.fecha))}</span>
          ${propio ? '' : `<button type="button" class="mensajes__reportar" data-reportar="${ui.escapar(mensaje.id)}">Reportar</button>`}
        </div>
      </div>`;
  }).join('');

  historialEl.innerHTML = `
    ${hayAnteriores ? '<div class="mensajes__anteriores"><button type="button" id="btn-ver-anteriores" class="btn btn--secundario btn--pequeno">Ver anteriores</button></div>' : ''}
    ${bloques || '<div class="vacio"><p class="vacio__texto">Aún no hay mensajes. ¡Inicia la conversación!</p></div>'}`;

  document.getElementById('btn-ver-anteriores')?.addEventListener('click', cargarAnteriores);
  historialEl.querySelectorAll('[data-reportar]').forEach(boton => {
    boton.addEventListener('click', () => reportarMensaje(boton.dataset.reportar));
  });
  if (mantenerPosicion) {
    historialEl.scrollTop = historialEl.scrollHeight - alturaAnterior + desplazamientoAnterior;
  } else {
    historialEl.scrollTop = historialEl.scrollHeight;
  }
}

async function cargarConversaciones() {
  try {
    const respuesta = await llamar('GET', `/api/mensajes/conversaciones?_=${Date.now()}`);
    const fotoPropiaAnterior = perfilActual?.foto || '';
    const fotoContactoAnterior = conversacionActiva?.otro?.foto || '';
    perfilActual = respuesta.usuario || perfilActual;
    conversaciones = respuesta.conversaciones || [];
    if (conversacionActiva) {
      conversacionActiva = conversaciones.find(item => item.id === conversacionActiva.id) || conversacionActiva;
      actualizarEstadoChat();
      if (fotoPropiaAnterior !== (perfilActual?.foto || '') || fotoContactoAnterior !== (conversacionActiva.otro?.foto || '')) {
        renderizarMensajes({ mantenerPosicion: true });
      }
    }
    renderizarConversaciones();
  } catch (error) {
    ui.aviso(error.message || 'No se pudieron cargar las conversaciones', 'error');
  }
}

async function abrirConversacion(id) {
  const seleccionada = conversaciones.find(item => item.id === id);
  if (!seleccionada) return;
  conversacionActiva = seleccionada;
  tituloChatEl.textContent = nombreDe(seleccionada.otro);
  rolContactoEl.textContent = seleccionada.otro?.rol || '';
  formEl.hidden = false;
  actualizarEstadoChat();
  bandeja.classList.add('mensajes__bandeja--chat');
  renderizarConversaciones();

  try {
    const respuesta = await llamar('GET', `/api/mensajes/${encodeURIComponent(id)}`);
    mensajes = respuesta.mensajes || [];
    hayAnteriores = mensajes.length === 50;
    renderizarMensajes();
    await marcarLeido();
    textoEl.focus();
  } catch (error) {
    ui.aviso(error.message || 'No se pudo abrir la conversación', 'error');
  }
}

async function reportarMensaje(mensajeId) {
  if (!conversacionActiva) return;
  const caja = document.createElement('div');
  caja.className = 'campo';
  caja.innerHTML = '<label for="motivo-reporte-mensaje">Motivo del reporte</label><textarea id="motivo-reporte-mensaje" maxlength="1000" rows="5" required></textarea><small class="campo__ayuda">Explica por qué el mensaje debe ser revisado.</small>';
  const aceptar = await ui.modal({
    titulo: 'Reportar mensaje',
    contenido: caja,
    acciones: [
      { texto: 'Cancelar', valor: false, clase: 'btn--secundario' },
      { texto: 'Enviar reporte', valor: true, clase: 'btn--primario' }
    ]
  });
  if (!aceptar) return;
  const motivo = caja.querySelector('textarea').value.trim();
  if (!motivo) return ui.aviso('Escribe el motivo del reporte.', 'error');
  try {
    await crear('reportes', {
      tipo: 'mensaje',
      referenciaId: `${conversacionActiva.id}/${mensajeId}`,
      motivo
    });
    ui.aviso('Mensaje reportado para revisión.', 'exito');
  } catch (error) {
    ui.aviso(error.message || 'No se pudo enviar el reporte', 'error');
  }
}

async function alternarBloqueo() {
  if (!conversacionActiva?.otro?.id) return;
  const desbloquear = conversacionActiva.bloqueadoPorMi;
  const accion = desbloquear ? 'desbloquear' : 'bloquear';
  if (!await ui.confirmar(`¿Deseas ${accion} a ${nombreDe(conversacionActiva.otro)}?`)) return;
  try {
    if (desbloquear) {
      await llamar('DELETE', `/api/mensajes/bloquear/${encodeURIComponent(conversacionActiva.otro.id)}`);
    } else {
      await llamar('POST', '/api/mensajes/bloquear', { usuarioId: conversacionActiva.otro.id });
    }
    await cargarConversaciones();
    ui.aviso(desbloquear ? 'Contacto desbloqueado.' : 'Contacto bloqueado.', 'exito');
  } catch (error) {
    ui.aviso(error.message || `No se pudo ${accion} el contacto`, 'error');
  }
}

async function enviarDifusion() {
  try {
    const [grupos, asignaturas] = await Promise.all([listar('distributivo'), listar('asignaturas')]);
    const propios = grupos.filter(grupo => String(grupo.docenteId) === String(usuario.id));
    if (!propios.length) return ui.aviso('No tienes grupos asignados.', 'info');
    const nombres = new Map(asignaturas.map(item => [String(item.id), item.nombre]));
    const caja = document.createElement('div');
    caja.innerHTML = `<div class="campo"><label for="grupo-difusion">Curso</label><select id="grupo-difusion">${propios.map(grupo => `<option value="${ui.escapar(grupo.id)}">${ui.escapar(nombres.get(String(grupo.asignaturaId)) || 'Asignatura')} · ${ui.escapar(grupo.paralelo || '')}</option>`).join('')}</select></div><div class="campo"><label for="texto-difusion">Mensaje</label><textarea id="texto-difusion" maxlength="2000" rows="6" required></textarea><small class="campo__ayuda">Se enviará a cada estudiante del grupo.</small></div>`;
    const aceptar = await ui.modal({
      titulo: 'Mensaje al curso',
      contenido: caja,
      acciones: [
        { texto: 'Cancelar', valor: false, clase: 'btn--secundario' },
        { texto: 'Enviar', valor: true, clase: 'btn--primario' }
      ]
    });
    if (!aceptar) return;
    const texto = caja.querySelector('#texto-difusion').value.trim();
    if (!texto) return ui.aviso('Escribe el mensaje para el curso.', 'error');
    const resultado = await llamar('POST', '/api/mensajes/difusion', {
      grupoId: caja.querySelector('#grupo-difusion').value,
      texto
    });
    await cargarConversaciones();
    ui.aviso(`Mensaje enviado a ${resultado.enviados?.length || 0} estudiantes.`, 'exito');
  } catch (error) {
    ui.aviso(error.message || 'No se pudo enviar el mensaje al curso', 'error');
  }
}

async function cargarAnteriores() {
  if (!conversacionActiva || !mensajes.length) return;
  try {
    const antes = mensajes[0].fecha;
    const respuesta = await llamar('GET', `/api/mensajes/${encodeURIComponent(conversacionActiva.id)}?antes=${encodeURIComponent(antes)}`);
    const anteriores = respuesta.mensajes || [];
    const existentes = new Set(mensajes.map(item => item.id));
    mensajes = [...anteriores.filter(item => !existentes.has(item.id)), ...mensajes];
    hayAnteriores = anteriores.length === 50;
    renderizarMensajes({ mantenerPosicion: true });
  } catch (error) {
    ui.aviso(error.message || 'No se pudieron cargar mensajes anteriores', 'error');
  }
}

async function marcarLeido() {
  if (!conversacionActiva) return;
  await llamar('POST', `/api/mensajes/${encodeURIComponent(conversacionActiva.id)}/leido`);
  conversacionActiva.noLeidos = 0;
  renderizarConversaciones();
  const respuesta = await llamar('GET', '/api/mensajes/no-leidos');
  const badge = document.getElementById('badge-mensajes-no-leidos');
  const total = Number(respuesta.total) || 0;
  if (badge) {
    badge.textContent = total > 99 ? '99+' : total;
    badge.style.display = total > 0 ? 'inline-flex' : 'none';
  }
}

async function cargarNuevos() {
  if (!conversacionActiva || cargandoNuevos || document.hidden) return;
  cargandoNuevos = true;
  try {
    const ultimo = mensajes[mensajes.length - 1];
    const desde = ultimo ? new Date(new Date(ultimo.fecha).getTime() - 1000).toISOString() : '';
    const query = `?${desde ? `desde=${encodeURIComponent(desde)}&` : ''}_=${Date.now()}`;
    const respuesta = await llamar('GET', `/api/mensajes/${encodeURIComponent(conversacionActiva.id)}${query}`);
    const existentes = new Set(mensajes.map(item => item.id));
    const nuevos = (respuesta.mensajes || []).filter(item => !existentes.has(item.id));
    if (nuevos.length) {
      mensajes.push(...nuevos);
      renderizarMensajes();
      await marcarLeido();
    }
  } catch {
    // El sondeo en segundo plano no interrumpe la escritura.
  } finally {
    cargandoNuevos = false;
  }
}

async function nuevaConversacion() {
  try {
    const respuesta = await llamar('GET', '/api/mensajes/contactos');
    const contactos = respuesta.contactos || [];
    if (!contactos.length) {
      ui.aviso('No tienes contactos disponibles', 'info');
      return;
    }
    const selector = document.createElement('div');
    selector.className = 'campo';
    selector.innerHTML = `
      <label for="contacto-nuevo">Contacto</label>
      <select id="contacto-nuevo">
        ${contactos.map(contacto => `<option value="${ui.escapar(contacto.id)}">${ui.escapar(nombreDe(contacto))} · ${ui.escapar(contacto.rol)}</option>`).join('')}
      </select>`;
    const resultado = await ui.modal({
      titulo: 'Nueva conversación',
      contenido: selector,
      acciones: [
        { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
        { texto: 'Conversar', valor: 'crear', clase: 'btn--primario' }
      ]
    });
    if (resultado !== 'crear') return;
    const contactoId = selector.querySelector('select').value;
    const conversacion = await llamar('POST', '/api/mensajes/conversaciones', { con: contactoId });
    await cargarConversaciones();
    await abrirConversacion(conversacion.id);
  } catch (error) {
    ui.aviso(error.message || 'No se pudo iniciar la conversación', 'error');
  }
}

formEl.addEventListener('submit', async evento => {
  evento.preventDefault();
  if (!conversacionActiva) return;
  const texto = textoEl.value.trim();
  if (!texto) return;
  try {
    const mensaje = await llamar('POST', `/api/mensajes/${encodeURIComponent(conversacionActiva.id)}`, { texto });
    mensajes.push(mensaje);
    textoEl.value = '';
    contadorEl.textContent = '0 / 2.000';
    renderizarMensajes();
    await cargarConversaciones();
    textoEl.focus();
  } catch (error) {
    ui.aviso(error.message || 'No se pudo enviar el mensaje', 'error');
  }
});

textoEl.addEventListener('input', () => {
  contadorEl.textContent = `${textoEl.value.length.toLocaleString('es-EC')} / 2.000`;
});

textoEl.addEventListener('keydown', evento => {
  if (evento.key === 'Enter' && !evento.shiftKey) {
    evento.preventDefault();
    formEl.requestSubmit();
  }
});

buscarEl.addEventListener('input', renderizarConversaciones);
btnNuevaEl.addEventListener('click', nuevaConversacion);
btnDifusionEl.addEventListener('click', enviarDifusion);
btnBloqueoEl.addEventListener('click', alternarBloqueo);
btnVolverEl.addEventListener('click', () => bandeja.classList.remove('mensajes__bandeja--chat'));

await cargarConversaciones();

setInterval(() => {
  if (!document.hidden) cargarNuevos();
}, 4000);

setInterval(() => {
  if (!document.hidden) cargarConversaciones();
}, 15000);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    cargarConversaciones();
    cargarNuevos();
  }
});

window.addEventListener('focus', () => {
  cargarConversaciones();
  cargarNuevos();
});
