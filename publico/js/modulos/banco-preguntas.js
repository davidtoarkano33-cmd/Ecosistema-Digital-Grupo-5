// publico/js/modulos/banco-preguntas.js · Banco docente por niveles cognitivos
import { montarPlantilla } from '../nucleo/plantilla.js';
import { listar, crear, actualizar, ia } from '../nucleo/api.js';
import { aviso, modal, cargando, escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Banco de preguntas', roles: ['docente', 'admin'] });

const contenido = document.getElementById('contenido');
const NIVELES = ['Recordar', 'Comprender', 'Aplicar', 'Analizar', 'Evaluar'];
const TIPOS = { opcion: 'Opción múltiple', vf: 'Verdadero o falso', completar: 'Completar' };

let asignaturas = [];
let unidades = [];
let temas = [];
let preguntas = [];
let temaId = '';
let nivelActivo = 1;

function preguntaVacia(origen = 'docente') {
  return {
    tipo: 'opcion',
    enunciado: '',
    opciones: ['', '', '', ''],
    correcta: 0,
    retroalimentacion: '',
    origen,
    estado: 'aprobado'
  };
}

function normalizarPregunta(datos, origen = 'docente') {
  const tipo = ['opcion', 'vf', 'completar'].includes(datos?.tipo) ? datos.tipo : 'opcion';
  let opciones = Array.isArray(datos?.opciones) ? datos.opciones.map(String) : [];
  let correcta = datos?.correcta;

  if (tipo === 'opcion') {
    opciones = [...opciones, '', '', '', ''].slice(0, 4);
    correcta = Number(correcta);
    if (!Number.isInteger(correcta) || correcta < 0 || correcta > 3) correcta = 0;
  } else if (tipo === 'vf') {
    opciones = ['Verdadero', 'Falso'];
    correcta = correcta === true || correcta === 'true';
  } else {
    opciones = [];
    correcta = String(correcta ?? '');
  }

  return {
    tipo,
    enunciado: String(datos?.enunciado ?? '').trim(),
    opciones,
    correcta,
    retroalimentacion: String(datos?.retroalimentacion ?? '').trim(),
    origen,
    estado: 'aprobado'
  };
}

function validarPregunta(datos) {
  if (!datos.enunciado) return 'El enunciado es obligatorio.';
  if (!datos.retroalimentacion) return 'La retroalimentación es obligatoria.';
  if (datos.tipo === 'opcion' && (datos.opciones.length !== 4 || datos.opciones.some(item => !item.trim()))) {
    return 'Completa las cuatro opciones.';
  }
  if (datos.tipo === 'completar' && !datos.enunciado.includes('____')) {
    return 'El enunciado de completar debe incluir ____.';
  }
  if (datos.tipo === 'completar' && !String(datos.correcta).trim()) return 'Escribe la respuesta correcta.';
  return '';
}

function opcionesHtml(pregunta) {
  if (pregunta.tipo === 'completar') return '';
  return `<ol class="pregunta-opciones">${pregunta.opciones.map((opcion, indice) => {
    const correcta = pregunta.tipo === 'vf'
      ? Boolean(pregunta.correcta) === (indice === 0)
      : Number(pregunta.correcta) === indice;
    return `<li>${escapar(opcion)}${correcta ? ' ✓' : ''}</li>`;
  }).join('')}</ol>`;
}

function renderizarBase() {
  contenido.innerHTML = `
    <section class="banco-cabecera">
      <div>
        <h1>Banco de preguntas</h1>
        <p>Gestiona preguntas aprobadas por tema y nivel cognitivo.</p>
      </div>
      <div class="banco-acciones">
        <button type="button" class="btn btn--secundario" id="btn-generar">✨ Generar con IA</button>
        <button type="button" class="btn btn--primario" id="btn-nueva">+ Pregunta manual</button>
      </div>
    </section>

    <section class="tarjeta banco-selector" aria-label="Seleccionar contenido">
      <div class="campo">
        <label for="selector-asignatura">Asignatura</label>
        <select id="selector-asignatura"></select>
      </div>
      <div class="campo">
        <label for="selector-unidad">Unidad</label>
        <select id="selector-unidad"></select>
      </div>
      <div class="campo">
        <label for="selector-tema">Tema</label>
        <select id="selector-tema"></select>
      </div>
    </section>

    <div class="banco-niveles" id="banco-niveles" role="tablist" aria-label="Niveles cognitivos"></div>
    <section class="tarjeta" id="panel-nivel" role="tabpanel" aria-live="polite"></section>
  `;

  document.getElementById('btn-nueva').addEventListener('click', crearManual);
  document.getElementById('btn-generar').addEventListener('click', generarConIa);
  montarSelectores();
}

function montarSelectores() {
  const selectorAsignatura = document.getElementById('selector-asignatura');
  const selectorUnidad = document.getElementById('selector-unidad');
  const selectorTema = document.getElementById('selector-tema');

  const actualizarTemas = async () => {
    const disponibles = temas.filter(item => item.unidadId === selectorUnidad.value);
    selectorTema.innerHTML = disponibles.map(item => `<option value="${escapar(item.id)}">${escapar(item.titulo)}</option>`).join('');
    temaId = selectorTema.value || '';
    await cargarPreguntas();
  };

  const actualizarUnidades = async () => {
    const disponibles = unidades.filter(item => item.asignaturaId === selectorAsignatura.value);
    selectorUnidad.innerHTML = disponibles.map(item => `<option value="${escapar(item.id)}">${escapar(item.titulo)}</option>`).join('');
    await actualizarTemas();
  };

  selectorAsignatura.innerHTML = asignaturas.map(item => `<option value="${escapar(item.id)}">${escapar(item.nombre)}</option>`).join('');
  selectorAsignatura.addEventListener('change', actualizarUnidades);
  selectorUnidad.addEventListener('change', actualizarTemas);
  selectorTema.addEventListener('change', async () => {
    temaId = selectorTema.value;
    await cargarPreguntas();
  });
  actualizarUnidades();
}

async function cargarPreguntas() {
  if (!temaId) {
    preguntas = [];
    renderizarNiveles();
    renderizarLista();
    return;
  }
  cargando(true);
  try {
    preguntas = await listar('preguntas', { temaId });
    renderizarNiveles();
    renderizarLista();
  } catch (error) {
    aviso(error.message || 'No se pudo cargar el banco de preguntas.', 'error');
  } finally {
    cargando(false);
  }
}

function renderizarNiveles() {
  const contenedor = document.getElementById('banco-niveles');
  if (!contenedor) return;
  contenedor.innerHTML = NIVELES.map((nombre, indice) => {
    const nivel = indice + 1;
    const total = preguntas.filter(item => Number(item.nivel) === nivel && item.estado === 'aprobado').length;
    return `
      <button type="button" class="banco-nivel" role="tab" data-nivel="${nivel}" aria-selected="${nivel === nivelActivo}">
        <strong>Nivel ${nivel}</strong>
        <span>${escapar(nombre)} · ${total} aprobadas</span>
      </button>`;
  }).join('');
  contenedor.querySelectorAll('[data-nivel]').forEach(boton => boton.addEventListener('click', () => {
    nivelActivo = Number(boton.dataset.nivel);
    renderizarNiveles();
    renderizarLista();
  }));
}

function renderizarLista() {
  const panel = document.getElementById('panel-nivel');
  if (!panel) return;
  if (!temaId) {
    panel.innerHTML = '<div class="vacio"><h2 class="vacio__titulo">Sin temas disponibles</h2><p class="vacio__texto">Selecciona una asignatura con unidades y temas.</p></div>';
    return;
  }

  const lista = preguntas.filter(item => Number(item.nivel) === nivelActivo);
  const aprobadas = lista.filter(item => item.estado === 'aprobado').length;
  panel.innerHTML = `
    <div class="nivel-resumen">
      <div><h2>Nivel ${nivelActivo}: ${escapar(NIVELES[nivelActivo - 1])}</h2><p>${aprobadas} preguntas aprobadas</p></div>
      <span class="insignia ${aprobadas >= 20 ? 'insignia--exito' : 'insignia--advertencia'}">${aprobadas}/20 mínimo recomendado</span>
    </div>
    ${aprobadas < 20 ? `<p class="banco-aviso">Faltan ${20 - aprobadas} preguntas aprobadas para completar este nivel.</p>` : ''}
    <div class="lista-preguntas" id="lista-preguntas">
      ${lista.length ? lista.map(item => `
        <article class="pregunta-item">
          <div class="pregunta-item__encabezado">
            <div><span class="insignia insignia--info">${escapar(TIPOS[item.tipo] || item.tipo)}</span> <span class="insignia insignia--exito">${escapar(item.estado)}</span>${item.origen === 'ia' ? ' <span class="insignia insignia--acento">Generada con IA</span>' : ''}</div>
          </div>
          <p class="pregunta-item__enunciado">${escapar(item.enunciado)}</p>
          ${opcionesHtml(item)}
          <p class="pregunta-item__retro">${escapar(item.retroalimentacion)}</p>
          <div class="pregunta-acciones"><button type="button" class="btn btn--secundario btn--pequeno" data-editar="${escapar(item.id)}">Editar</button></div>
        </article>`).join('') : '<div class="vacio"><h3 class="vacio__titulo">Este nivel aún no tiene preguntas</h3><p class="vacio__texto">Crea una pregunta manual o genera propuestas con IA.</p></div>'}
    </div>`;

  panel.querySelectorAll('[data-editar]').forEach(boton => boton.addEventListener('click', () => {
    const pregunta = preguntas.find(item => item.id === boton.dataset.editar);
    if (pregunta) editarGuardada(pregunta);
  }));
}

function construirFormulario(datos) {
  const form = document.createElement('form');
  form.className = 'pila pila--m';
  form.noValidate = true;
  form.innerHTML = `
    <div class="campo"><label for="pregunta-tipo">Tipo</label><select id="pregunta-tipo">
      ${Object.entries(TIPOS).map(([valor, texto]) => `<option value="${valor}" ${datos.tipo === valor ? 'selected' : ''}>${texto}</option>`).join('')}
    </select></div>
    <div class="campo"><label for="pregunta-enunciado">Enunciado</label><textarea id="pregunta-enunciado" rows="3" required>${escapar(datos.enunciado)}</textarea></div>
    <div id="pregunta-respuestas"></div>
    <div class="campo"><label for="pregunta-retro">Retroalimentación</label><textarea id="pregunta-retro" rows="3" required>${escapar(datos.retroalimentacion)}</textarea></div>`;

  const tipo = form.querySelector('#pregunta-tipo');
  const respuestas = form.querySelector('#pregunta-respuestas');
  const dibujarRespuestas = () => {
    if (tipo.value === 'opcion') {
      const opciones = [...(datos.opciones || []), '', '', '', ''].slice(0, 4);
      respuestas.innerHTML = `<div class="opciones-editor">${opciones.map((valor, indice) => `<div class="campo"><label for="opcion-${indice}">Opción ${indice + 1}</label><input id="opcion-${indice}" data-opcion="${indice}" value="${escapar(valor)}" required></div>`).join('')}</div><div class="campo"><label for="pregunta-correcta-opcion">Opción correcta</label><select id="pregunta-correcta-opcion">${opciones.map((_, indice) => `<option value="${indice}" ${Number(datos.correcta) === indice ? 'selected' : ''}>Opción ${indice + 1}</option>`).join('')}</select></div>`;
    } else if (tipo.value === 'vf') {
      respuestas.innerHTML = `<div class="campo"><label for="pregunta-correcta-vf">Respuesta correcta</label><select id="pregunta-correcta-vf"><option value="true" ${datos.correcta === true ? 'selected' : ''}>Verdadero</option><option value="false" ${datos.correcta === false ? 'selected' : ''}>Falso</option></select></div>`;
    } else {
      respuestas.innerHTML = `<div class="campo"><label for="pregunta-correcta-texto">Respuesta correcta</label><input id="pregunta-correcta-texto" value="${escapar(typeof datos.correcta === 'string' ? datos.correcta : '')}" required><small class="campo__ayuda">El enunciado debe contener ____.</small></div>`;
    }
  };
  tipo.addEventListener('change', () => {
    datos.tipo = tipo.value;
    datos.opciones = tipo.value === 'opcion' ? ['', '', '', ''] : tipo.value === 'vf' ? ['Verdadero', 'Falso'] : [];
    datos.correcta = tipo.value === 'opcion' ? 0 : tipo.value === 'vf' ? true : '';
    dibujarRespuestas();
  });
  dibujarRespuestas();
  return form;
}

function leerFormulario(form, base) {
  const tipo = form.querySelector('#pregunta-tipo').value;
  const resultado = {
    ...base,
    tipo,
    enunciado: form.querySelector('#pregunta-enunciado').value.trim(),
    retroalimentacion: form.querySelector('#pregunta-retro').value.trim()
  };
  if (tipo === 'opcion') {
    resultado.opciones = [...form.querySelectorAll('[data-opcion]')].map(input => input.value.trim());
    resultado.correcta = Number(form.querySelector('#pregunta-correcta-opcion').value);
  } else if (tipo === 'vf') {
    resultado.opciones = ['Verdadero', 'Falso'];
    resultado.correcta = form.querySelector('#pregunta-correcta-vf').value === 'true';
  } else {
    resultado.opciones = [];
    resultado.correcta = form.querySelector('#pregunta-correcta-texto').value.trim();
  }
  return resultado;
}

async function editarPregunta(datos, titulo) {
  const borrador = normalizarPregunta(datos, datos.origen || 'docente');
  const form = construirFormulario(borrador);
  const guardar = await modal({
    titulo,
    contenido: form,
    acciones: [{ texto: 'Cancelar', valor: false, clase: 'btn--secundario' }, { texto: 'Guardar', valor: true, clase: 'btn--primario' }]
  });
  if (!guardar) return null;
  const resultado = leerFormulario(form, borrador);
  const error = validarPregunta(resultado);
  if (error) {
    aviso(error, 'error');
    return editarPregunta(resultado, titulo);
  }
  return resultado;
}

async function crearManual() {
  if (!temaId) return aviso('Selecciona un tema.', 'error');
  const datos = await editarPregunta(preguntaVacia(), 'Nueva pregunta manual');
  if (!datos) return;
  cargando(true);
  try {
    const guardada = await crear('preguntas', { ...datos, temaId, nivel: nivelActivo, origen: 'docente', estado: 'aprobado' });
    preguntas.push(guardada);
    renderizarNiveles();
    renderizarLista();
    aviso('Pregunta creada y aprobada.', 'exito');
  } catch (error) {
    aviso(error.message || 'No se pudo guardar la pregunta.', 'error');
  } finally {
    cargando(false);
  }
}

async function editarGuardada(pregunta) {
  const datos = await editarPregunta(pregunta, 'Editar pregunta');
  if (!datos) return;
  cargando(true);
  try {
    const guardada = await actualizar('preguntas', pregunta.id, { ...datos, temaId: pregunta.temaId, nivel: pregunta.nivel, origen: pregunta.origen, estado: 'aprobado' });
    preguntas = preguntas.map(item => item.id === guardada.id ? guardada : item);
    renderizarLista();
    aviso('Pregunta actualizada.', 'exito');
  } catch (error) {
    aviso(error.message || 'No se pudo actualizar la pregunta.', 'error');
  } finally {
    cargando(false);
  }
}

async function generarConIa() {
  if (!temaId) return aviso('Selecciona un tema.', 'error');
  const form = document.createElement('div');
  form.className = 'campo';
  form.innerHTML = '<label for="cantidad-ia">Cantidad (5 a 15)</label><input id="cantidad-ia" type="number" min="5" max="15" value="10">';
  const aceptar = await modal({
    titulo: `Generar preguntas · Nivel ${nivelActivo}`,
    contenido: form,
    acciones: [{ texto: 'Cancelar', valor: false, clase: 'btn--secundario' }, { texto: 'Generar', valor: true, clase: 'btn--primario' }]
  });
  if (!aceptar) return;
  const cantidad = Number(form.querySelector('#cantidad-ia').value);
  if (!Number.isInteger(cantidad) || cantidad < 5 || cantidad > 15) return aviso('La cantidad debe estar entre 5 y 15.', 'error');

  let resultado;
  cargando(true);
  try {
    resultado = await ia('generar-preguntas', { temaId, nivel: nivelActivo, cantidad });
    if (!Array.isArray(resultado) || !resultado.length) throw new Error('La IA no devolvió propuestas válidas.');
  } catch (error) {
    aviso(error.message || 'No se pudieron generar preguntas.', 'error');
    return;
  } finally {
    cargando(false);
  }

  await revisarPropuestas(resultado.map(item => normalizarPregunta(item, 'ia')));
}

async function revisarPropuestas(iniciales) {
  let propuestas = iniciales;
  const vista = document.createElement('div');
  vista.className = 'lista-propuestas';

  const dibujar = () => {
    vista.innerHTML = propuestas.length ? propuestas.map((item, indice) => `
      <article class="propuesta-item" data-propuesta="${indice}">
        <div class="propuesta-item__encabezado"><span class="insignia insignia--info">${escapar(TIPOS[item.tipo])}</span></div>
        <p class="propuesta-item__enunciado">${escapar(item.enunciado)}</p>
        ${opcionesHtml(item)}
        <p class="propuesta-item__retro">${escapar(item.retroalimentacion)}</p>
        <div class="propuesta-acciones">
          <button type="button" class="btn btn--secundario btn--pequeno" data-editar-propuesta="${indice}">Editar</button>
          <button type="button" class="btn btn--primario btn--pequeno" data-aprobar-propuesta="${indice}">Aprobar</button>
          <button type="button" class="btn btn--peligro btn--pequeno" data-descartar-propuesta="${indice}">Descartar</button>
        </div>
      </article>`).join('') : '<div class="vacio"><p class="vacio__texto">No quedan propuestas por revisar.</p></div>';

    vista.querySelectorAll('[data-editar-propuesta]').forEach(boton => boton.addEventListener('click', async () => {
      const indice = Number(boton.dataset.editarPropuesta);
      const editada = await editarPregunta(propuestas[indice], 'Editar propuesta de IA');
      if (editada) {
        propuestas[indice] = { ...editada, origen: 'ia' };
        dibujar();
      }
    }));
    vista.querySelectorAll('[data-descartar-propuesta]').forEach(boton => boton.addEventListener('click', () => {
      propuestas.splice(Number(boton.dataset.descartarPropuesta), 1);
      dibujar();
    }));
    vista.querySelectorAll('[data-aprobar-propuesta]').forEach(boton => boton.addEventListener('click', async () => {
      await aprobarPropuestas([Number(boton.dataset.aprobarPropuesta)]);
    }));
  };

  async function aprobarPropuestas(indices) {
    const seleccionadas = indices.map(indice => propuestas[indice]).filter(Boolean);
    if (!seleccionadas.length) return;
    cargando(true);
    try {
      const guardadas = [];
      for (const propuesta of seleccionadas) {
        const error = validarPregunta(propuesta);
        if (error) throw new Error(error);
        guardadas.push(await crear('preguntas', { ...propuesta, temaId, nivel: nivelActivo, origen: 'ia', estado: 'aprobado' }));
      }
      preguntas.push(...guardadas);
      propuestas = propuestas.filter(item => !seleccionadas.includes(item));
      renderizarNiveles();
      renderizarLista();
      dibujar();
      aviso(`${guardadas.length} pregunta(s) aprobada(s).`, 'exito');
    } catch (error) {
      aviso(error.message || 'No se pudieron aprobar las propuestas.', 'error');
    } finally {
      cargando(false);
    }
  }

  dibujar();
  await modal({
    titulo: 'Revisar propuestas de IA',
    contenido: vista,
    acciones: [
      { texto: 'Cerrar', valor: 'cerrar', clase: 'btn--secundario' },
      { texto: 'Aprobar todas', valor: 'todas', clase: 'btn--primario' }
    ]
  }).then(async accion => {
    if (accion === 'todas') await aprobarPropuestas(propuestas.map((_, indice) => indice));
  });
}

async function iniciar() {
  cargando(true);
  try {
    [asignaturas, unidades, temas] = await Promise.all([
      listar('asignaturas'),
      listar('unidades'),
      listar('temas')
    ]);
    renderizarBase();
  } catch (error) {
    contenido.innerHTML = '<div class="vacio"><h1 class="vacio__titulo">No se pudo abrir el banco</h1></div>';
    aviso(error.message || 'No se pudieron cargar los contenidos.', 'error');
  } finally {
    cargando(false);
  }
}

await iniciar();
