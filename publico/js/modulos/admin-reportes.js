import { montarPlantilla } from '../nucleo/plantilla.js';
import { listar, actualizar } from '../nucleo/api.js';
import { aviso, cargando, confirmar, escapar } from '../nucleo/ui.js';
import { fechaRelativa, formatoBasico } from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Reportes', roles: ['admin'] });
let reportes = [];
let hilos = [];
let respuestas = [];

function referencia(reporte) {
  const [coleccion, id] = String(reporte.referenciaId || '').split('/');
  if (coleccion === 'foros-hilos') return { coleccion, registro: hilos.find(h => h.id === id) };
  if (coleccion === 'foros-respuestas') return { coleccion, registro: respuestas.find(r => r.id === id) };
  return { coleccion, registro: null };
}

function renderizar() {
  const pendientes = reportes.filter(r => r.estado === 'pendiente');
  document.getElementById('contador-reportes').textContent = `${pendientes.length} ${pendientes.length === 1 ? 'pendiente' : 'pendientes'}`;
  document.getElementById('lista-reportes').innerHTML = pendientes.length ? pendientes.map(reporte => {
    const ref = referencia(reporte);
    const titulo = ref.coleccion === 'foros-hilos' ? ref.registro?.titulo : 'Respuesta del foro';
    return `<article class="tarjeta" data-reporte="${reporte.id}">
      <div class="reportes__meta"><span class="insignia insignia--advertencia">Pendiente</span><span>Enviado ${escapar(fechaRelativa(reporte.fecha))}</span><span>${ref.coleccion === 'foros-hilos' ? 'Hilo' : 'Respuesta'}</span></div>
      <h3>${escapar(titulo || 'Publicación no disponible')}</h3>
      <p><strong>Motivo:</strong> ${escapar(reporte.motivo)}</p>
      <div class="reportes__publicacion">${ref.registro ? formatoBasico(ref.registro.texto) : '<p>El contenido ya no está disponible.</p>'}</div>
      <div class="reportes__acciones">
        <button type="button" class="btn btn--secundario" data-accion="descartar" data-id="${reporte.id}">Descartar</button>
        <button type="button" class="btn btn--peligro" data-accion="ocultar" data-id="${reporte.id}" ${ref.registro ? '' : 'disabled'}>Ocultar contenido</button>
      </div>
    </article>`;
  }).join('') : '<div class="vacio"><div class="vacio__icono">✓</div><h3 class="vacio__titulo">No hay reportes pendientes</h3><p class="vacio__texto">La bandeja de moderación está al día.</p></div>';
}

async function resolver(id, ocultar) {
  const reporte = reportes.find(r => r.id === id);
  if (!reporte) return;
  const pregunta = ocultar ? '¿Ocultar esta publicación y resolver el reporte?' : '¿Descartar este reporte sin ocultar la publicación?';
  if (!await confirmar(pregunta)) return;
  try {
    cargando(true);
    if (ocultar) {
      const ref = referencia(reporte);
      if (!ref.registro) throw new Error('La publicación ya no está disponible.');
      const campo = ref.coleccion === 'foros-hilos' ? 'oculto' : 'oculta';
      await actualizar(ref.coleccion, ref.registro.id, { [campo]: true });
    }
    const resuelto = await actualizar('reportes', id, { estado: 'resuelto' });
    reportes = reportes.map(r => r.id === id ? resuelto : r);
    renderizar(); aviso(ocultar ? 'Contenido ocultado y reporte resuelto.' : 'Reporte descartado.', 'exito');
  } catch (error) { aviso(error.message, 'error'); } finally { cargando(false); }
}

document.getElementById('lista-reportes').addEventListener('click', e => { const b = e.target.closest('[data-accion]'); if (b) resolver(b.dataset.id, b.dataset.accion === 'ocultar'); });
try {
  cargando(true);
  [reportes, hilos, respuestas] = await Promise.all([listar('reportes', { estado: 'pendiente' }), listar('foros-hilos'), listar('foros-respuestas')]);
  renderizar();
} catch (error) { aviso(error.message, 'error'); } finally { cargando(false); }
