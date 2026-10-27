import { montarPlantilla } from '../nucleo/plantilla.js';
import { listar, actualizar, llamar } from '../nucleo/api.js';
import { aviso, cargando, confirmar, escapar } from '../nucleo/ui.js';
import { fechaRelativa, formatoBasico } from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Reportes', roles: ['admin'] });

let reportes = [];
let hilos = [];
let respuestas = [];
let usuarios = [];
const contextos = new Map();

function referenciaForo(reporte) {
  const [coleccion, id] = String(reporte.referenciaId || '').split('/');
  if (coleccion === 'foros-hilos') return { coleccion, registro: hilos.find(item => item.id === id) };
  if (coleccion === 'foros-respuestas') return { coleccion, registro: respuestas.find(item => item.id === id) };
  return { coleccion, registro: null };
}

function nombreUsuario(id) {
  const usuario = usuarios.find(item => String(item.id) === String(id));
  return usuario ? `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() : 'Usuario no disponible';
}

function renderizarContexto(reporte) {
  const contexto = contextos.get(reporte.id);
  if (!contexto) return '<p>No se pudo cargar el contexto del mensaje.</p>';
  const mensajes = [...(contexto.anteriores || []), contexto.mensaje];
  return `<div class="reportes__contexto">${mensajes.map(mensaje => `
    <div class="reportes__mensaje${mensaje.id === contexto.mensaje.id ? ' reportes__mensaje--reportado' : ''}">
      <small>${escapar(nombreUsuario(mensaje.autorId))}${mensaje.id === contexto.mensaje.id ? ' · Mensaje reportado' : ''}</small>
      <p>${escapar(mensaje.texto || '')}</p>
    </div>`).join('')}</div>`;
}

function tarjetaMensaje(reporte) {
  const contexto = contextos.get(reporte.id);
  const autorId = contexto?.mensaje?.autorId || '';
  return `<article class="tarjeta" data-reporte="${escapar(reporte.id)}">
    <div class="reportes__meta"><span class="insignia insignia--advertencia">Pendiente</span><span>Enviado ${escapar(fechaRelativa(reporte.fecha))}</span><span>Mensaje</span></div>
    <h3>Reporte de mensaje privado</h3>
    <p><strong>Motivo:</strong> ${escapar(reporte.motivo)}</p>
    ${renderizarContexto(reporte)}
    <div class="reportes__acciones">
      <button type="button" class="btn btn--secundario" data-accion="descartar" data-id="${escapar(reporte.id)}">Descartar</button>
      <button type="button" class="btn btn--peligro" data-accion="desactivar" data-id="${escapar(reporte.id)}" data-usuario="${escapar(autorId)}" ${autorId ? '' : 'disabled'}>Desactivar usuario</button>
      <button type="button" class="btn btn--peligro" data-accion="ocultar-mensaje" data-id="${escapar(reporte.id)}" ${contexto?.mensaje ? '' : 'disabled'}>Ocultar mensaje</button>
    </div>
  </article>`;
}

function tarjetaForo(reporte) {
  const ref = referenciaForo(reporte);
  const titulo = ref.coleccion === 'foros-hilos' ? ref.registro?.titulo : 'Respuesta del foro';
  return `<article class="tarjeta" data-reporte="${escapar(reporte.id)}">
    <div class="reportes__meta"><span class="insignia insignia--advertencia">Pendiente</span><span>Enviado ${escapar(fechaRelativa(reporte.fecha))}</span><span>${ref.coleccion === 'foros-hilos' ? 'Hilo' : 'Respuesta'}</span></div>
    <h3>${escapar(titulo || 'Publicación no disponible')}</h3>
    <p><strong>Motivo:</strong> ${escapar(reporte.motivo)}</p>
    <div class="reportes__publicacion">${ref.registro ? formatoBasico(ref.registro.texto) : '<p>El contenido ya no está disponible.</p>'}</div>
    <div class="reportes__acciones">
      <button type="button" class="btn btn--secundario" data-accion="descartar" data-id="${escapar(reporte.id)}">Descartar</button>
      <button type="button" class="btn btn--peligro" data-accion="ocultar-foro" data-id="${escapar(reporte.id)}" ${ref.registro ? '' : 'disabled'}>Ocultar contenido</button>
    </div>
  </article>`;
}

function renderizar() {
  const pendientes = reportes.filter(item => item.estado === 'pendiente');
  document.getElementById('contador-reportes').textContent = `${pendientes.length} ${pendientes.length === 1 ? 'pendiente' : 'pendientes'}`;
  document.getElementById('lista-reportes').innerHTML = pendientes.length
    ? pendientes.map(reporte => reporte.tipo === 'mensaje' ? tarjetaMensaje(reporte) : tarjetaForo(reporte)).join('')
    : '<div class="vacio"><div class="vacio__icono">✓</div><h3 class="vacio__titulo">No hay reportes pendientes</h3><p class="vacio__texto">La bandeja de moderación está al día.</p></div>';
}

async function resolverReporte(id) {
  const resuelto = await actualizar('reportes', id, { estado: 'resuelto' });
  reportes = reportes.map(item => item.id === id ? resuelto : item);
  renderizar();
}

async function ejecutarAccion(boton) {
  const reporte = reportes.find(item => item.id === boton.dataset.id);
  if (!reporte) return;
  const accion = boton.dataset.accion;
  const preguntas = {
    descartar: '¿Descartar este reporte sin ocultar el contenido?',
    'ocultar-foro': '¿Ocultar esta publicación y resolver el reporte?',
    'ocultar-mensaje': '¿Ocultar el mensaje reportado y resolver el reporte?',
    desactivar: '¿Desactivar al usuario que envió el mensaje y resolver el reporte?'
  };
  if (!await confirmar(preguntas[accion])) return;

  try {
    cargando(true);
    if (accion === 'ocultar-foro') {
      const ref = referenciaForo(reporte);
      if (!ref.registro) throw new Error('La publicación ya no está disponible.');
      const campo = ref.coleccion === 'foros-hilos' ? 'oculto' : 'oculta';
      await actualizar(ref.coleccion, ref.registro.id, { [campo]: true });
    }
    if (accion === 'ocultar-mensaje') {
      await llamar('POST', '/api/mensajes/ocultar', { referenciaId: reporte.referenciaId });
    }
    if (accion === 'desactivar') {
      if (!boton.dataset.usuario) throw new Error('No se pudo identificar al autor del mensaje.');
      await actualizar('usuarios', boton.dataset.usuario, { activo: false });
    }
    await resolverReporte(reporte.id);
    const textos = {
      descartar: 'Reporte descartado.',
      'ocultar-foro': 'Contenido ocultado y reporte resuelto.',
      'ocultar-mensaje': 'Mensaje ocultado y reporte resuelto.',
      desactivar: 'Usuario desactivado y reporte resuelto.'
    };
    aviso(textos[accion], 'exito');
  } catch (error) {
    aviso(error.message || 'No se pudo resolver el reporte', 'error');
  } finally {
    cargando(false);
  }
}

document.getElementById('lista-reportes').addEventListener('click', evento => {
  const boton = evento.target.closest('[data-accion]');
  if (boton) ejecutarAccion(boton);
});

try {
  cargando(true);
  [reportes, hilos, respuestas, usuarios] = await Promise.all([
    listar('reportes', { estado: 'pendiente' }),
    listar('foros-hilos'),
    listar('foros-respuestas'),
    listar('usuarios')
  ]);
  const reportesMensaje = reportes.filter(item => item.tipo === 'mensaje');
  await Promise.all(reportesMensaje.map(async reporte => {
    try {
      contextos.set(reporte.id, await llamar('GET', `/api/mensajes/reporte/${encodeURIComponent(reporte.id)}`));
    } catch {
      contextos.set(reporte.id, null);
    }
  }));
  renderizar();
} catch (error) {
  aviso(error.message, 'error');
} finally {
  cargando(false);
}
