import { montarPlantilla } from '../nucleo/plantilla.js';
import { listar, crear, actualizar } from '../nucleo/api.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { aviso, cargando, confirmar, escapar, modal } from '../nucleo/ui.js';
import { fechaRelativa, formatoBasico, parametro } from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Conversación del foro', roles: ['sesion'] });
const usuario = usuarioActual();
const esModerador = ['docente', 'admin'].includes(usuario?.rol);
const hiloId = parametro('id');
const POR_PAGINA = 20;
let hilo;
let respuestas = [];
let pagina = 1;

function botonesModeracion(tipo, registro) {
  if (!esModerador) return '';
  if (tipo === 'hilo') return `
    <button class="btn btn--secundario btn--pequeno" data-accion="fijar" data-id="${registro.id}">${registro.fijado ? 'Desfijar' : 'Fijar'}</button>
    <button class="btn btn--secundario btn--pequeno" data-accion="cerrar" data-id="${registro.id}">${registro.cerrado ? 'Reabrir' : 'Cerrar'}</button>
    <button class="btn btn--peligro btn--pequeno" data-accion="ocultar-hilo" data-id="${registro.id}">${registro.oculto ? 'Mostrar' : 'Ocultar'}</button>`;
  return `<button class="btn btn--secundario btn--pequeno" data-accion="destacar" data-id="${registro.id}">${registro.destacada ? 'Quitar destaque' : 'Destacar'}</button>
    <button class="btn btn--peligro btn--pequeno" data-accion="ocultar-respuesta" data-id="${registro.id}">${registro.oculta ? 'Mostrar' : 'Ocultar'}</button>`;
}

function renderizarHilo() {
  const el = document.getElementById('hilo-principal');
  if (!hilo) { el.innerHTML = '<div class="vacio"><h1 class="vacio__titulo">Hilo no encontrado</h1></div>'; return; }
  el.innerHTML = `<article class="tarjeta hilo__publicacion hilo__principal">
    <div class="foros__etiquetas">${hilo.fijado ? '<span class="insignia insignia--acento">Fijado</span>' : ''}${hilo.cerrado ? '<span class="insignia insignia--advertencia">Cerrado</span>' : ''}${hilo.oculto ? '<span class="insignia insignia--error">Oculto</span>' : ''}</div>
    <h1 class="hilo__titulo">${escapar(hilo.titulo)}</h1>
    <div class="hilo__meta"><span>${String(hilo.autorId) === String(usuario.id) ? 'Tu publicación' : 'Participante'}</span><span>${escapar(fechaRelativa(hilo.fecha))}</span></div>
    <div class="hilo__contenido">${formatoBasico(hilo.texto)}</div>
    <div class="hilo__acciones"><button class="btn btn--texto btn--pequeno" data-accion="reportar-hilo" data-id="${hilo.id}">Reportar</button>${botonesModeracion('hilo', hilo)}</div>
  </article>`;
  const seccion = document.getElementById('seccion-responder');
  seccion.hidden = Boolean(hilo.cerrado);
  document.getElementById('aviso-hilo-cerrado')?.remove();
  if (hilo.cerrado) seccion.insertAdjacentHTML('beforebegin', '<p id="aviso-hilo-cerrado" class="tarjeta hilo__cerrado">Este hilo está cerrado y no admite nuevas respuestas.</p>');
}

function renderizarRespuestas() {
  document.getElementById('cantidad-respuestas').textContent = respuestas.length;
  const ordenadas = [...respuestas].sort((a, b) => Number(Boolean(b.destacada)) - Number(Boolean(a.destacada)) || new Date(a.fecha) - new Date(b.fecha));
  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / POR_PAGINA));
  pagina = Math.min(pagina, totalPaginas);
  const visibles = ordenadas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  document.getElementById('lista-respuestas').innerHTML = visibles.length ? visibles.map((r, i) => `<article class="tarjeta hilo__publicacion ${r.destacada ? 'hilo__respuesta--destacada' : ''}">
    <div class="hilo__meta"><strong>Respuesta ${(pagina - 1) * POR_PAGINA + i + 1}</strong><span>${String(r.autorId) === String(usuario.id) ? 'Tu publicación' : 'Participante'}</span><span>${escapar(fechaRelativa(r.fecha))}</span>${r.destacada ? '<span class="insignia insignia--acento">Destacada</span>' : ''}${r.oculta ? '<span class="insignia insignia--error">Oculta</span>' : ''}</div>
    <div class="hilo__contenido">${formatoBasico(r.texto)}</div>
    <div class="hilo__acciones"><button class="btn btn--texto btn--pequeno" data-accion="reportar-respuesta" data-id="${r.id}">Reportar</button>${botonesModeracion('respuesta', r)}</div>
  </article>`).join('') : '<div class="vacio"><p class="vacio__texto">Todavía no hay respuestas. Sé la primera persona en participar.</p></div>';
  const paginacion = document.getElementById('paginacion');
  paginacion.innerHTML = totalPaginas > 1 ? `${pagina > 1 ? '<button class="btn btn--secundario btn--pequeno" data-pagina="anterior">Anterior</button>' : ''}<span>Página ${pagina} de ${totalPaginas}</span>${pagina < totalPaginas ? '<button class="btn btn--secundario btn--pequeno" data-pagina="siguiente">Siguiente</button>' : ''}` : '';
}

async function reportar(coleccion, id) {
  const caja = document.createElement('div');
  caja.innerHTML = '<div class="campo"><label for="motivo-reporte">Motivo del reporte</label><textarea id="motivo-reporte" maxlength="1000" rows="5" required></textarea><small class="campo__ayuda">Explica brevemente por qué debe revisarse.</small></div>';
  const aceptar = await modal({ titulo: 'Reportar publicación', contenido: caja, acciones: [{ texto: 'Cancelar', valor: false, clase: 'btn--secundario' }, { texto: 'Enviar reporte', valor: true, clase: 'btn--primario' }] });
  if (!aceptar) return;
  const motivo = caja.querySelector('textarea').value.trim();
  if (!motivo) return aviso('Escribe el motivo del reporte.', 'error');
  await crear('reportes', { tipo: 'foro', referenciaId: `${coleccion}/${id}`, motivo });
  aviso('Reporte enviado para revisión.', 'exito');
}

async function moderar(accion, id) {
  const cambios = { fijar: ['foros-hilos', { fijado: !hilo.fijado }], cerrar: ['foros-hilos', { cerrado: !hilo.cerrado }], 'ocultar-hilo': ['foros-hilos', { oculto: !hilo.oculto }] };
  if (cambios[accion]) {
    if (accion.startsWith('ocultar') && !await confirmar('¿Deseas cambiar la visibilidad de este hilo?')) return;
    hilo = await actualizar(cambios[accion][0], id, cambios[accion][1]);
    renderizarHilo(); return;
  }
  const respuesta = respuestas.find(r => r.id === id);
  if (!respuesta) return;
  const campo = accion === 'destacar' ? 'destacada' : 'oculta';
  if (campo === 'oculta' && !await confirmar('¿Deseas cambiar la visibilidad de esta respuesta?')) return;
  const actualizada = await actualizar('foros-respuestas', id, { [campo]: !respuesta[campo] });
  respuestas = respuestas.map(r => r.id === id ? actualizada : r);
  renderizarRespuestas();
}

async function manejarAccion(evento) {
  const boton = evento.target.closest('[data-accion]');
  if (!boton) return;
  try {
    cargando(true);
    if (boton.dataset.accion === 'reportar-hilo') await reportar('foros-hilos', boton.dataset.id);
    else if (boton.dataset.accion === 'reportar-respuesta') await reportar('foros-respuestas', boton.dataset.id);
    else await moderar(boton.dataset.accion, boton.dataset.id);
  } catch (error) { aviso(error.message, 'error'); } finally { cargando(false); }
}

async function cargar() {
  if (!hiloId) return aviso('Falta el identificador del hilo.', 'error');
  try {
    cargando(true);
    const encontrados = await listar('foros-hilos', { id: hiloId });
    hilo = encontrados[0];
    respuestas = hilo ? await listar('foros-respuestas', { hiloId }) : [];
    renderizarHilo(); renderizarRespuestas();
  } catch (error) { aviso(error.message, 'error'); } finally { cargando(false); }
}

document.getElementById('contenido').addEventListener('click', manejarAccion);
document.getElementById('paginacion').addEventListener('click', e => { const b = e.target.closest('[data-pagina]'); if (!b) return; pagina += b.dataset.pagina === 'siguiente' ? 1 : -1; renderizarRespuestas(); document.getElementById('titulo-respuestas').scrollIntoView(); });
document.getElementById('form-respuesta').addEventListener('submit', async e => {
  e.preventDefault(); const campo = document.getElementById('texto-respuesta'); const texto = campo.value.trim();
  if (!texto) return aviso('Escribe una respuesta.', 'error');
  try { cargando(true); const nueva = await crear('foros-respuestas', { hiloId, texto }); respuestas.push(nueva); campo.value = ''; pagina = Math.ceil(respuestas.length / POR_PAGINA); renderizarRespuestas(); aviso('Respuesta publicada.', 'exito'); }
  catch (error) { aviso(error.message, 'error'); } finally { cargando(false); }
});
await cargar();
