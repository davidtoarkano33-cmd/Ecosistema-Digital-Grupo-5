// publico/js/nucleo/selector-tema.js · Selector de tema para actividades y juegos
import { listar, obtener } from './api.js';
import { modal, escapar, cargando } from './ui.js';
import { parametro } from './util.js';

/**
 * Obtiene el tema para una actividad o juego didáctico.
 * Si existe ?temaId= en la URL lo recupera de la API; si no, abre un modal
 * con selectores en cascada (asignatura → unidad → tema publicados).
 * @returns {Promise<Object|null>} El tema seleccionado o null si se cancela
 */
export async function obtenerTemaActividad() {
  const temaIdParam = parametro('temaId') || new URLSearchParams(window.location.search).get('temaId');
  if (temaIdParam) {
    try {
      const tema = await obtener('temas', temaIdParam);
      if (tema) return tema;
    } catch (e) {
      console.warn('No se pudo cargar el tema indicado por parámetro:', e);
    }
  }

  // Cargar datos académicos para el selector
  cargando(true);
  let todasAsignaturas = [];
  let todasUnidades = [];
  let todosTemas = [];
  try {
    [todasAsignaturas, todasUnidades, todosTemas] = await Promise.all([
      listar('asignaturas'),
      listar('unidades'),
      listar('temas')
    ]);
  } finally {
    cargando(false);
  }

  const temasPublicados = (todosTemas || []).filter(t => t.estado === 'publicado');
  const unidadesVisibles = (todasUnidades || []).filter(u => u.visible !== false);

  if (temasPublicados.length === 0) {
    await modal({
      titulo: 'Sin temas disponibles',
      contenido: '<p>No hay temas publicados disponibles para realizar esta actividad en este momento.</p>',
      acciones: [{ texto: 'Entendido', valor: null, clase: 'btn--primario' }]
    });
    return null;
  }

  // Filtrar asignaturas y unidades que tengan temas publicados
  const unidadesConTemas = unidadesVisibles.filter(u =>
    temasPublicados.some(t => t.unidadId === u.id)
  );

  const asignaturasConTemas = (todasAsignaturas || []).filter(a =>
    unidadesConTemas.some(u => u.asignaturaId === a.id)
  );

  if (asignaturasConTemas.length === 0) {
    await modal({
      titulo: 'Sin contenidos',
      contenido: '<p>No se encontraron asignaturas con temas aptos para practicar.</p>',
      acciones: [{ texto: 'Aceptar', valor: null, clase: 'btn--primario' }]
    });
    return null;
  }

  // Construir el elemento del selector interactivo
  const contenedor = document.createElement('div');
  contenedor.className = 'pila pila--m';

  contenedor.innerHTML = `
    <p style="margin: 0; font-size: var(--tamano-s); color: var(--texto-suave);">
      Elige el tema que deseas repasar en esta actividad:
    </p>
    <div class="campo">
      <label for="sel-asig-modal" class="campo__etiqueta">Asignatura</label>
      <select id="sel-asig-modal" class="campo__control"></select>
    </div>
    <div class="campo">
      <label for="sel-uni-modal" class="campo__etiqueta">Unidad</label>
      <select id="sel-uni-modal" class="campo__control"></select>
    </div>
    <div class="campo">
      <label for="sel-tema-modal" class="campo__etiqueta">Tema publicado</label>
      <select id="sel-tema-modal" class="campo__control"></select>
    </div>
  `;

  const selAsig = contenedor.querySelector('#sel-asig-modal');
  const selUni = contenedor.querySelector('#sel-uni-modal');
  const selTema = contenedor.querySelector('#sel-tema-modal');

  function actualizarUnidades() {
    const asigId = selAsig.value;
    const unidadesFiltradas = unidadesConTemas.filter(u => u.asignaturaId === asigId);
    selUni.innerHTML = unidadesFiltradas.map(u =>
      `<option value="${escapar(u.id)}">${escapar(u.titulo)}</option>`
    ).join('');
    actualizarTemas();
  }

  function actualizarTemas() {
    const uniId = selUni.value;
    const temasFiltrados = temasPublicados.filter(t => t.unidadId === uniId);
    selTema.innerHTML = temasFiltrados.map(t =>
      `<option value="${escapar(t.id)}">${escapar(t.titulo)}</option>`
    ).join('');
  }

  selAsig.innerHTML = asignaturasConTemas.map(a =>
    `<option value="${escapar(a.id)}">${escapar(a.nombre)}</option>`
  ).join('');

  selAsig.addEventListener('change', actualizarUnidades);
  selUni.addEventListener('change', actualizarTemas);

  actualizarUnidades();

  const accionElegida = await modal({
    titulo: 'Seleccionar Tema de Estudio',
    contenido: contenedor,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
      { texto: 'Comenzar actividad', valor: 'aceptar', clase: 'btn--primario' }
    ]
  });

  if (accionElegida === 'aceptar') {
    const idSeleccionado = selTema.value;
    const temaEncontrado = temasPublicados.find(t => t.id === idSeleccionado);
    return temaEncontrado || null;
  }

  return null;
}

export default {
  obtenerTemaActividad
};
