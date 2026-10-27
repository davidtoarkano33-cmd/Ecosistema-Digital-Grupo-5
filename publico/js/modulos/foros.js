import { montarPlantilla } from '../nucleo/plantilla.js';
import { listar, crear } from '../nucleo/api.js';
import { aviso, cargando, escapar, modal } from '../nucleo/ui.js';
import { fechaRelativa } from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Foros', roles: ['sesion'] });

const asignaturaEl = document.getElementById('filtro-asignatura');
const temaEl = document.getElementById('filtro-tema');
const listaEl = document.getElementById('lista-hilos');
const contadorEl = document.getElementById('contador-hilos');
let asignaturas = [];
let unidades = [];
let temas = [];
let hilos = [];
let respuestas = [];

function temasDeAsignatura(asignaturaId) {
  const ids = new Set(unidades.filter(u => u.asignaturaId === asignaturaId).map(u => u.id));
  return temas.filter(t => ids.has(t.unidadId));
}

function llenarTemas() {
  const disponibles = temasDeAsignatura(asignaturaEl.value);
  temaEl.innerHTML = '<option value="">Todos los temas</option>' + disponibles
    .map(t => `<option value="${escapar(t.id)}">${escapar(t.titulo)}</option>`).join('');
}

function renderizar() {
  const temaId = temaEl.value;
  const visibles = hilos
    .filter(h => h.asignaturaId === asignaturaEl.value && (!temaId || h.temaId === temaId))
    .sort((a, b) => Number(Boolean(b.fijado)) - Number(Boolean(a.fijado)) ||
      new Date(b.ultimoMovimiento || b.fecha) - new Date(a.ultimoMovimiento || a.fecha));
  contadorEl.textContent = `${visibles.length} ${visibles.length === 1 ? 'hilo' : 'hilos'}`;

  if (!visibles.length) {
    listaEl.innerHTML = '<div class="vacio"><div class="vacio__icono">💬</div><h3 class="vacio__titulo">Aún no hay conversaciones</h3><p class="vacio__texto">Crea el primer hilo para esta selección.</p></div>';
    return;
  }
  listaEl.innerHTML = visibles.map(hilo => {
    const cantidad = respuestas.filter(r => r.hiloId === hilo.id).length;
    const tema = temas.find(t => t.id === hilo.temaId);
    const extracto = String(hilo.texto || '').replace(/\s+/g, ' ').slice(0, 180);
    return `<a class="tarjeta tarjeta--interactiva foro-hilo" href="/paginas/hilo.html?id=${encodeURIComponent(hilo.id)}">
      <div class="foros__etiquetas">
        ${hilo.fijado ? '<span class="insignia insignia--acento">Fijado</span>' : ''}
        ${hilo.cerrado ? '<span class="insignia insignia--advertencia">Cerrado</span>' : ''}
        ${hilo.oculto ? '<span class="insignia insignia--error">Oculto</span>' : ''}
        ${tema ? `<span class="insignia insignia--info">${escapar(tema.titulo)}</span>` : ''}
      </div>
      <h3 class="foro-hilo__titulo">${escapar(hilo.titulo)}</h3>
      <p class="foro-hilo__extracto">${escapar(extracto)}${extracto.length === 180 ? '…' : ''}</p>
      <div class="foros__meta"><span>${cantidad} ${cantidad === 1 ? 'respuesta' : 'respuestas'}</span><span>Último movimiento ${escapar(fechaRelativa(hilo.ultimoMovimiento || hilo.fecha))}</span></div>
    </a>`;
  }).join('');
}

async function abrirNuevoHilo() {
  if (!asignaturaEl.value) return aviso('No tienes asignaturas disponibles.', 'error');
  const caja = document.createElement('div');
  const temasDisponibles = temasDeAsignatura(asignaturaEl.value);
  caja.innerHTML = `<div class="pila pila--m">
    <div class="campo"><label for="nuevo-titulo">Título</label><input id="nuevo-titulo" maxlength="200" required></div>
    <div class="campo"><label for="nuevo-tema">Tema (opcional)</label><select id="nuevo-tema"><option value="">Foro general</option>${temasDisponibles.map(t => `<option value="${escapar(t.id)}" ${t.id === temaEl.value ? 'selected' : ''}>${escapar(t.titulo)}</option>`).join('')}</select></div>
    <div class="campo"><label for="nuevo-texto">Mensaje</label><textarea id="nuevo-texto" maxlength="5000" rows="8" required></textarea><small class="campo__ayuda">Máximo 5.000 caracteres.</small></div>
  </div>`;
  const aceptar = await modal({ titulo: 'Nuevo hilo', contenido: caja, acciones: [
    { texto: 'Cancelar', valor: false, clase: 'btn--secundario' },
    { texto: 'Publicar', valor: true, clase: 'btn--primario' }
  ] });
  if (!aceptar) return;
  const titulo = caja.querySelector('#nuevo-titulo').value.trim();
  const texto = caja.querySelector('#nuevo-texto').value.trim();
  const temaId = caja.querySelector('#nuevo-tema').value;
  if (!titulo || !texto) return aviso('Completa el título y el mensaje.', 'error');
  try {
    cargando(true);
    const nuevo = await crear('foros-hilos', { asignaturaId: asignaturaEl.value, temaId: temaId || null, titulo, texto });
    window.location.href = `/paginas/hilo.html?id=${encodeURIComponent(nuevo.id)}`;
  } catch (error) { aviso(error.message, 'error'); } finally { cargando(false); }
}

async function cargar() {
  try {
    cargando(true);
    [asignaturas, unidades, temas, hilos, respuestas] = await Promise.all([
      listar('asignaturas'), listar('unidades'), listar('temas'), listar('foros-hilos'), listar('foros-respuestas')
    ]);
    asignaturaEl.innerHTML = asignaturas.map(a => `<option value="${escapar(a.id)}">${escapar(a.nombre)}</option>`).join('');
    llenarTemas();
    renderizar();
  } catch (error) { aviso(error.message, 'error'); listaEl.innerHTML = '<div class="vacio"><p class="vacio__texto">No fue posible cargar los foros.</p></div>'; }
  finally { cargando(false); }
}

asignaturaEl.addEventListener('change', () => { llenarTemas(); renderizar(); });
temaEl.addEventListener('change', renderizar);
document.getElementById('btn-nuevo-hilo').addEventListener('click', abrirNuevoHilo);
await cargar();
