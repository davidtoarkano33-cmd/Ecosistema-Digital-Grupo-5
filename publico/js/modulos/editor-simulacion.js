// publico/js/modulos/editor-simulacion.js · Editor visual de escenarios ramificados
import { montarPlantilla } from '../nucleo/plantilla.js';
import { actualizar, crear, ia, listar, obtener, subir } from '../nucleo/api.js';
import { aviso, cargando, confirmar, escapar, modal } from '../nucleo/ui.js';
import { parametro } from '../nucleo/util.js';

await montarPlantilla({ titulo: "Editor de escenarios", roles: ["docente", "admin"] });

const contenido = document.getElementById('contenido');
let simulacionId = parametro('id');
let temas = [];
let simulacion = nuevaSimulacion();
let cambiosSinGuardar = false;
let secuenciaEscenas = 1;

function nuevaSimulacion() {
  return {
    titulo: '',
    temaId: '',
    modo: 'escenarios',
    estado: 'borrador',
    escenaInicial: 'E1',
    escenas: [nuevaEscena('E1')],
    personaje: { nombre: '', descripcion: '', contexto: '', objetivo: '' },
    rubrica: [
      { criterio: '', descripcion: '', puntos: 10 },
      { criterio: '', descripcion: '', puntos: 10 },
      { criterio: '', descripcion: '', puntos: 10 }
    ],
    maxTurnos: 8
  };
}

function nuevaEscena(id) {
  return { id, texto: '', imagen: '', opciones: [] };
}

function marcarCambio() {
  cambiosSinGuardar = true;
}

window.addEventListener('beforeunload', (evento) => {
  if (!cambiosSinGuardar) return;
  evento.preventDefault();
  evento.returnValue = '';
});

function normalizarDatos(datos) {
  const escenas = Array.isArray(datos.escenas) ? datos.escenas : [];
  return {
    ...datos,
    modo: datos.modo === 'rol' ? 'rol' : 'escenarios',
    estado: datos.estado === 'publicado' ? 'publicado' : 'borrador',
    escenaInicial: datos.escenaInicial || escenas[0]?.id || 'E1',
    escenas: escenas.map((escena, indice) => ({
      id: escena.id || `E${indice + 1}`,
      texto: escena.texto || '',
      imagen: escena.imagen || '',
      opciones: Array.isArray(escena.opciones) ? escena.opciones.map(opcion => ({
        texto: opcion.texto || '',
        destino: opcion.destino || '',
        puntos: Number(opcion.puntos) || 0,
        consecuencia: opcion.consecuencia || ''
      })) : []
    })),
    personaje: {
      nombre: datos.personaje?.nombre || '',
      descripcion: datos.personaje?.descripcion || '',
      contexto: datos.personaje?.contexto || '',
      objetivo: datos.personaje?.objetivo || ''
    },
    rubrica: Array.isArray(datos.rubrica) && datos.rubrica.length ? datos.rubrica.map(item => ({
      criterio: item.criterio || '', descripcion: item.descripcion || '', puntos: Number(item.puntos) || 0
    })) : nuevaSimulacion().rubrica,
    maxTurnos: Math.max(4, Math.min(12, Number(datos.maxTurnos) || 8))
  };
}

async function cargarEditor() {
  cargando(true);
  try {
    const tareas = [listar('temas')];
    if (simulacionId) tareas.push(obtener('simulaciones', simulacionId));
    const resultados = await Promise.all(tareas);
    temas = Array.isArray(resultados[0]) ? resultados[0] : [];
    if (simulacionId) simulacion = normalizarDatos(resultados[1]);
    secuenciaEscenas = Math.max(0, ...simulacion.escenas.map(e => Number(String(e.id).replace(/\D/g, '')) || 0));
    renderizar();
  } catch (error) {
    aviso(error.message || 'No se pudo cargar el editor.', 'error');
    contenido.innerHTML = '<div class="alerta alerta--error" role="alert">No se pudo cargar la simulación.</div>';
  } finally {
    cargando(false);
  }
}

function opcionesTemas() {
  return temas.map(tema => `
    <option value="${escapar(tema.id)}" ${tema.id === simulacion.temaId ? 'selected' : ''}>
      ${escapar(tema.titulo)}
    </option>
  `).join('');
}

function renderizar() {
  contenido.innerHTML = `
    <div class="editor-simulacion">
      <header class="editor-simulacion__cabecera">
        <div>
          <a href="/paginas/simulaciones.html" class="btn btn--texto btn--pequeno">← Volver a simulaciones</a>
          <h1>${simulacionId ? 'Editar simulación' : 'Nueva simulación'}</h1>
        </div>
        <div class="editor-simulacion__acciones">
          <button type="button" id="btn-generar-ia" class="btn btn--secundario">✨ Generar borrador con IA</button>
          <a id="btn-vista-previa" class="btn btn--secundario ${simulacionId ? '' : 'deshabilitado'}"
             ${simulacionId ? `href="/paginas/simulador.html?id=${encodeURIComponent(simulacionId)}&vista=previa"` : 'aria-disabled="true"'}>
            Vista previa
          </a>
          <button type="button" id="btn-guardar" class="btn btn--primario">Guardar</button>
        </div>
      </header>

      <section class="tarjeta" aria-labelledby="titulo-datos-generales">
        <h2 id="titulo-datos-generales" class="tarjeta__titulo">Datos generales</h2>
        <div class="datos-generales">
          <div class="campo">
            <label for="sim-titulo">Título</label>
            <input id="sim-titulo" type="text" required value="${escapar(simulacion.titulo)}">
          </div>
          <div class="campo">
            <label for="sim-tema">Tema</label>
            <select id="sim-tema" required>
              <option value="">Selecciona un tema</option>
              ${opcionesTemas()}
            </select>
          </div>
          <div class="campo">
            <label for="sim-modo">Modo</label>
            <select id="sim-modo">
              <option value="escenarios" ${simulacion.modo === 'escenarios' ? 'selected' : ''}>Escenarios</option>
              <option value="rol" ${simulacion.modo === 'rol' ? 'selected' : ''}>Rol</option>
            </select>
          </div>
          <div class="campo">
            <label for="sim-estado">Estado</label>
            <select id="sim-estado">
              <option value="borrador" ${simulacion.estado === 'borrador' ? 'selected' : ''}>Borrador</option>
              <option value="publicado" ${simulacion.estado === 'publicado' ? 'selected' : ''}>Publicado</option>
            </select>
          </div>
        </div>
      </section>

      <div id="errores-publicacion" aria-live="polite"></div>
      <div id="panel-modo"></div>
    </div>
  `;

  enlazarDatosGenerales();
  renderizarModo();
  document.getElementById('btn-generar-ia').addEventListener('click', abrirGeneradorIA);
  document.getElementById('btn-guardar').addEventListener('click', guardar);
}

async function abrirGeneradorIA() {
  const temaId = document.getElementById('sim-tema').value;
  const esRol = simulacion.modo === 'rol';
  if (!temaId) {
    aviso('Selecciona primero el tema del escenario.', 'error');
    document.getElementById('sim-tema').focus();
    return;
  }

  const formulario = document.createElement('div');
  formulario.className = 'generador-ia';
  formulario.innerHTML = `
    <p>${esRol
      ? 'Gemini creará el personaje, contexto, objetivo, rúbrica y cantidad de turnos. El resultado quedará como borrador.'
      : 'Gemini creará las decisiones, destinos, puntos y consecuencias. El resultado quedará como borrador.'}</p>
    <div class="campo">
      <label for="ia-situacion">Situación que quieres simular</label>
      <textarea id="ia-situacion" rows="5" maxlength="800" placeholder="Ejemplo: Un motociclista presenta dificultad respiratoria después de una colisión. El estudiante debe aplicar XABCDE y decidir el traslado."></textarea>
      <span class="campo__ayuda">Describe el caso, el contexto y qué debe practicar el estudiante.</span>
    </div>
    ${esRol ? '' : `<div class="campo">
      <label for="ia-escenas">Cantidad de escenas</label>
      <input id="ia-escenas" type="number" min="5" max="10" step="1" value="6">
    </div>`}
  `;
  const aceptar = await modal({
    titulo: esRol ? 'Generar práctica de rol con IA' : 'Generar escenario con IA',
    contenido: formulario,
    acciones: [
      { texto: 'Cancelar', valor: false, clase: 'btn--secundario' },
      { texto: 'Generar con Gemini', valor: true, clase: 'btn--primario' }
    ]
  });
  if (!aceptar) return;

  const situacion = formulario.querySelector('#ia-situacion').value.trim();
  const escenas = Number(formulario.querySelector('#ia-escenas')?.value);
  if (!situacion || situacion.length > 800) {
    aviso('La situación es obligatoria y no puede superar 800 caracteres.', 'error');
    return;
  }
  if (!esRol && (!Number.isInteger(escenas) || escenas < 5 || escenas > 10)) {
    aviso('La cantidad debe estar entre 5 y 10 escenas.', 'error');
    return;
  }
  const tieneContenido = esRol
    ? Object.values(simulacion.personaje).some(valor => String(valor).trim()) || simulacion.rubrica.some(item => item.criterio.trim() || item.descripcion.trim())
    : simulacion.escenas.some(escena => escena.texto.trim() || escena.opciones.length);
  if (tieneContenido) {
    const reemplazar = await confirmar(`La propuesta de la IA reemplazará ${esRol ? 'los datos de rol' : 'las escenas'} actuales. ¿Deseas continuar?`);
    if (!reemplazar) return;
  }

  cargando(true);
  try {
    const resultado = await ia(esRol ? 'generar-rol' : 'generar-escenario', esRol ? { temaId, situacion } : { temaId, situacion, escenas });
    if (!resultado || (esRol ? !resultado.personaje || !Array.isArray(resultado.rubrica) : !Array.isArray(resultado.escenas) || !resultado.escenas.length)) {
      throw new Error('La IA no devolvió un borrador válido.');
    }
    const generado = normalizarDatos({
      ...resultado,
      temaId,
      modo: esRol ? 'rol' : 'escenarios',
      estado: 'borrador'
    });
    simulacion = { ...simulacion, ...generado, temaId, modo: esRol ? 'rol' : 'escenarios', estado: 'borrador' };
    if (!esRol) secuenciaEscenas = Math.max(0, ...simulacion.escenas.map(e => Number(String(e.id).replace(/\D/g, '')) || 0));
    marcarCambio();
    renderizar();
    const errores = esRol ? validarBorradorRol() : validarPublicacion();
    if (!esRol) mostrarErrores(errores);
    aviso(
      errores.length
        ? 'Gemini generó el borrador. Revisa los errores señalados antes de guardarlo como publicado.'
        : 'Gemini generó un borrador válido. Revísalo y pulsa Guardar.',
      errores.length ? 'info' : 'exito'
    );
  } catch (error) {
    aviso(error.message || 'No se pudo generar el borrador con IA.', 'error');
  } finally {
    cargando(false);
  }
}

function validarBorradorRol() {
  const errores = [];
  const personaje = simulacion.personaje || {};
  for (const campo of ['nombre', 'descripcion', 'contexto', 'objetivo']) {
    if (!String(personaje[campo] || '').trim()) errores.push(`Falta ${campo} del personaje.`);
  }
  if (simulacion.rubrica.length < 3 || simulacion.rubrica.length > 5) errores.push('La rúbrica debe tener entre 3 y 5 criterios.');
  simulacion.rubrica.forEach((item, indice) => {
    if (!item.criterio.trim() || !item.descripcion.trim() || Number(item.puntos) <= 0) errores.push(`Revisa el criterio ${indice + 1}.`);
  });
  if (simulacion.maxTurnos < 4 || simulacion.maxTurnos > 12) errores.push('El máximo de turnos debe estar entre 4 y 12.');
  if (errores.length) aviso(errores.join(' '), 'error');
  return errores;
}

function enlazarDatosGenerales() {
  const campos = {
    'sim-titulo': 'titulo',
    'sim-tema': 'temaId',
    'sim-estado': 'estado'
  };
  for (const [id, propiedad] of Object.entries(campos)) {
    document.getElementById(id).addEventListener('input', (evento) => {
      simulacion[propiedad] = evento.target.value;
      marcarCambio();
    });
  }
  document.getElementById('sim-modo').addEventListener('change', (evento) => {
    simulacion.modo = evento.target.value;
    marcarCambio();
    renderizarModo();
  });
}

function renderizarModo() {
  const panel = document.getElementById('panel-modo');
  if (simulacion.modo === 'rol') {
    panel.innerHTML = `
      <section class="tarjeta" aria-labelledby="titulo-personaje">
        <div class="editor-simulacion__seccion-cabecera">
          <h2 id="titulo-personaje">Personaje y práctica</h2>
          <div class="campo campo--corto">
            <label for="rol-max-turnos">Máximo de turnos</label>
            <input id="rol-max-turnos" type="number" min="4" max="12" value="${simulacion.maxTurnos}">
          </div>
        </div>
        <div class="rol-datos">
          <div class="campo"><label for="rol-nombre">Nombre del personaje</label><input id="rol-nombre" value="${escapar(simulacion.personaje.nombre)}"></div>
          <div class="campo"><label for="rol-descripcion">Descripción</label><textarea id="rol-descripcion" rows="3">${escapar(simulacion.personaje.descripcion)}</textarea></div>
          <div class="campo"><label for="rol-contexto">Contexto del caso</label><textarea id="rol-contexto" rows="4">${escapar(simulacion.personaje.contexto)}</textarea></div>
          <div class="campo"><label for="rol-objetivo">Objetivo del estudiante</label><textarea id="rol-objetivo" rows="4">${escapar(simulacion.personaje.objetivo)}</textarea></div>
        </div>
      </section>
      <section class="tarjeta" aria-labelledby="titulo-rubrica">
        <div class="editor-simulacion__seccion-cabecera">
          <div><h2 id="titulo-rubrica">Rúbrica</h2><p>Agrega de 3 a 5 criterios de evaluación.</p></div>
          <button type="button" id="btn-agregar-criterio" class="btn btn--secundario" ${simulacion.rubrica.length >= 5 ? 'disabled' : ''}>+ Agregar criterio</button>
        </div>
        <div id="lista-rubrica" class="rubrica-lista">
          ${simulacion.rubrica.map((item, indice) => `
            <div class="rubrica-item" data-indice="${indice}">
              <div class="campo"><label>Criterio</label><input class="rubrica-criterio" value="${escapar(item.criterio)}"></div>
              <div class="campo"><label>Descripción</label><input class="rubrica-descripcion" value="${escapar(item.descripcion)}"></div>
              <div class="campo"><label>Puntos máximos</label><input class="rubrica-puntos" type="number" min="1" max="100" value="${item.puntos}"></div>
              <button type="button" class="btn btn--texto btn-eliminar-criterio" ${simulacion.rubrica.length <= 3 ? 'disabled' : ''}>Eliminar</button>
            </div>
          `).join('')}
        </div>
      </section>
    `;
    enlazarEditorRol();
    return;
  }

  panel.innerHTML = `
    <section aria-labelledby="titulo-escenas">
      <div class="editor-simulacion__seccion-cabecera">
        <div>
          <h2 id="titulo-escenas">Escenas</h2>
          <p>Una escena final no tiene opciones; las demás deben tener entre 2 y 4.</p>
        </div>
        <button type="button" id="btn-agregar-escena" class="btn btn--primario">+ Agregar escena</button>
      </div>
      <div id="escenas-lista" class="escenas-lista"></div>
    </section>
    <section id="mapa-escenario" class="tarjeta mapa-escenario" aria-labelledby="titulo-mapa"></section>
  `;
  document.getElementById('btn-agregar-escena').addEventListener('click', agregarEscena);
  renderizarEscenas();
  renderizarMapa();
}

function enlazarEditorRol() {
  const campos = { 'rol-nombre': 'nombre', 'rol-descripcion': 'descripcion', 'rol-contexto': 'contexto', 'rol-objetivo': 'objetivo' };
  for (const [id, propiedad] of Object.entries(campos)) {
    document.getElementById(id).addEventListener('input', evento => { simulacion.personaje[propiedad] = evento.target.value; marcarCambio(); });
  }
  document.getElementById('rol-max-turnos').addEventListener('input', evento => {
    simulacion.maxTurnos = Math.max(4, Math.min(12, Number(evento.target.value) || 4));
    marcarCambio();
  });
  document.querySelectorAll('.rubrica-item').forEach(elemento => {
    const indice = Number(elemento.dataset.indice);
    elemento.querySelector('.rubrica-criterio').addEventListener('input', e => { simulacion.rubrica[indice].criterio = e.target.value; marcarCambio(); });
    elemento.querySelector('.rubrica-descripcion').addEventListener('input', e => { simulacion.rubrica[indice].descripcion = e.target.value; marcarCambio(); });
    elemento.querySelector('.rubrica-puntos').addEventListener('input', e => { simulacion.rubrica[indice].puntos = Math.max(1, Number(e.target.value) || 1); marcarCambio(); });
    elemento.querySelector('.btn-eliminar-criterio').addEventListener('click', () => {
      if (simulacion.rubrica.length <= 3) return;
      simulacion.rubrica.splice(indice, 1); marcarCambio(); renderizarModo();
    });
  });
  document.getElementById('btn-agregar-criterio').addEventListener('click', () => {
    if (simulacion.rubrica.length >= 5) return;
    simulacion.rubrica.push({ criterio: '', descripcion: '', puntos: 10 }); marcarCambio(); renderizarModo();
  });
}

function renderizarEscenas() {
  const lista = document.getElementById('escenas-lista');
  if (!lista) return;
  lista.innerHTML = simulacion.escenas.map((escena, indice) => tarjetaEscena(escena, indice)).join('');

  lista.querySelectorAll('.escena').forEach(tarjeta => {
    const escena = simulacion.escenas.find(item => item.id === tarjeta.dataset.escenaId);
    if (!escena) return;
    tarjeta.querySelector('.escena-texto').addEventListener('input', evento => {
      escena.texto = evento.target.value;
      cambiarYActualizarMapa();
    });
    tarjeta.querySelector('.escena-imagen-url').addEventListener('input', evento => {
      escena.imagen = evento.target.value;
      marcarCambio();
    });
    tarjeta.querySelector('.escena-inicial').addEventListener('change', () => {
      simulacion.escenaInicial = escena.id;
      cambiarYActualizarMapa();
    });
    tarjeta.querySelector('.btn-eliminar-escena').addEventListener('click', () => eliminarEscena(escena.id));
    tarjeta.querySelector('.btn-agregar-opcion').addEventListener('click', () => agregarOpcion(escena.id));
    tarjeta.querySelector('.archivo-imagen').addEventListener('change', evento => subirImagen(escena.id, evento));
    tarjeta.querySelectorAll('.opcion').forEach((elemento, indiceOpcion) => enlazarOpcion(elemento, escena, indiceOpcion));
  });
}

function tarjetaEscena(escena, indice) {
  const destinos = simulacion.escenas.map(item => `
    <option value="${escapar(item.id)}">${escapar(item.id)}</option>
  `).join('');
  return `
    <article id="escena-${escapar(escena.id)}" class="tarjeta escena" data-escena-id="${escapar(escena.id)}">
      <header class="escena__cabecera">
        <h3>${escapar(escena.id)} · Escena ${indice + 1}</h3>
        <div class="editor-simulacion__acciones">
          <label><input type="radio" class="escena-inicial" name="escena-inicial" ${simulacion.escenaInicial === escena.id ? 'checked' : ''}> Escena inicial</label>
          <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar-escena" ${simulacion.escenas.length === 1 ? 'disabled' : ''}>Eliminar escena</button>
        </div>
      </header>
      <div class="escena__cuerpo">
        <div class="escena__datos">
          <div class="campo">
            <label for="texto-${escapar(escena.id)}">Texto de la escena</label>
            <textarea id="texto-${escapar(escena.id)}" class="escena-texto" rows="5">${escapar(escena.texto)}</textarea>
          </div>
          <div class="campo">
            <label for="imagen-${escapar(escena.id)}">Imagen</label>
            ${escena.imagen ? `<img class="escena__imagen" src="${escapar(escena.imagen)}" alt="Vista previa de ${escapar(escena.id)}">` : ''}
            <input id="imagen-${escapar(escena.id)}" class="escena-imagen-url" type="text" value="${escapar(escena.imagen)}" placeholder="URL de la imagen">
            <div class="imagen-acciones">
              <label class="btn btn--secundario btn--pequeno">
                Subir imagen
                <input class="archivo-imagen" type="file" accept="image/jpeg,image/png,image/webp" hidden>
              </label>
            </div>
          </div>
        </div>
        <div>
          <div class="editor-simulacion__seccion-cabecera">
            <h4>Opciones (${escena.opciones.length}/4)</h4>
            <button type="button" class="btn btn--secundario btn--pequeno btn-agregar-opcion" ${escena.opciones.length >= 4 ? 'disabled' : ''}>+ Agregar opción</button>
          </div>
          <div class="opciones-lista">
            ${escena.opciones.map((opcion, opcionIndice) => tarjetaOpcion(opcion, opcionIndice, destinos)).join('')}
            ${escena.opciones.length === 0 ? '<p class="campo__ayuda">Esta escena se considera final.</p>' : ''}
          </div>
        </div>
      </div>
    </article>
  `;
}

function tarjetaOpcion(opcion, indice, destinos) {
  return `
    <div class="opcion" data-opcion-indice="${indice}">
      <div class="opcion__cabecera">
        <h4>Opción ${indice + 1}</h4>
        <button type="button" class="btn btn--texto btn--pequeno btn-eliminar-opcion">Eliminar</button>
      </div>
      <div class="opcion__campos">
        <div class="campo">
          <label>Texto</label>
          <input class="opcion-texto" type="text" value="${escapar(opcion.texto)}">
        </div>
        <div class="campo">
          <label>Destino</label>
          <select class="opcion-destino">
            <option value="">Selecciona</option>
            ${destinos.replace(`value="${escapar(opcion.destino)}"`, `value="${escapar(opcion.destino)}" selected`)}
          </select>
        </div>
        <div class="campo">
          <label>Puntos (−10 a 10)</label>
          <input class="opcion-puntos" type="number" min="-10" max="10" step="1" value="${Number(opcion.puntos) || 0}">
        </div>
        <div class="campo opcion__consecuencia">
          <label>Consecuencia</label>
          <textarea class="opcion-consecuencia" rows="2">${escapar(opcion.consecuencia)}</textarea>
        </div>
      </div>
    </div>
  `;
}

function enlazarOpcion(elemento, escena, indice) {
  const opcion = escena.opciones[indice];
  elemento.querySelector('.opcion-texto').addEventListener('input', evento => {
    opcion.texto = evento.target.value;
    cambiarYActualizarMapa();
  });
  elemento.querySelector('.opcion-destino').addEventListener('change', evento => {
    opcion.destino = evento.target.value;
    cambiarYActualizarMapa();
  });
  elemento.querySelector('.opcion-puntos').addEventListener('input', evento => {
    opcion.puntos = Math.max(-10, Math.min(10, Number(evento.target.value) || 0));
    marcarCambio();
  });
  elemento.querySelector('.opcion-consecuencia').addEventListener('input', evento => {
    opcion.consecuencia = evento.target.value;
    marcarCambio();
  });
  elemento.querySelector('.btn-eliminar-opcion').addEventListener('click', () => {
    escena.opciones.splice(indice, 1);
    marcarCambio();
    renderizarEscenas();
    renderizarMapa();
  });
}

function cambiarYActualizarMapa() {
  marcarCambio();
  renderizarMapa();
}

function agregarEscena() {
  secuenciaEscenas += 1;
  simulacion.escenas.push(nuevaEscena(`E${secuenciaEscenas}`));
  marcarCambio();
  renderizarEscenas();
  renderizarMapa();
  document.getElementById(`escena-E${secuenciaEscenas}`)?.scrollIntoView({ behavior: 'smooth' });
}

async function eliminarEscena(id) {
  if (simulacion.escenas.length === 1) return;
  const aceptar = await confirmar(`¿Eliminar ${escapar(id)}? También se quitará como destino de otras opciones.`);
  if (!aceptar) return;
  simulacion.escenas = simulacion.escenas.filter(escena => escena.id !== id);
  for (const escena of simulacion.escenas) {
    escena.opciones.forEach(opcion => {
      if (opcion.destino === id) opcion.destino = '';
    });
  }
  if (simulacion.escenaInicial === id) simulacion.escenaInicial = simulacion.escenas[0].id;
  marcarCambio();
  renderizarEscenas();
  renderizarMapa();
}

function agregarOpcion(escenaId) {
  const escena = simulacion.escenas.find(item => item.id === escenaId);
  if (!escena || escena.opciones.length >= 4) return;
  escena.opciones.push({ texto: '', destino: '', puntos: 0, consecuencia: '' });
  marcarCambio();
  renderizarEscenas();
  renderizarMapa();
}

async function subirImagen(escenaId, evento) {
  const archivo = evento.target.files?.[0];
  if (!archivo) return;
  cargando(true);
  try {
    const resultado = await subir(archivo);
    const escena = simulacion.escenas.find(item => item.id === escenaId);
    if (escena && resultado?.url) {
      escena.imagen = resultado.url;
      marcarCambio();
      renderizarEscenas();
      renderizarMapa();
      aviso('Imagen subida correctamente.', 'exito');
    }
  } catch (error) {
    aviso(error.message || 'No se pudo subir la imagen.', 'error');
  } finally {
    cargando(false);
  }
}

function renderizarMapa() {
  const panel = document.getElementById('mapa-escenario');
  if (!panel) return;
  const porId = new Map(simulacion.escenas.map(escena => [escena.id, escena]));
  const visitadas = new Set();

  function rama(id, nivel = 0) {
    const escena = porId.get(id);
    if (!escena) return `<li>${escapar(id || 'Sin destino')} (destino inexistente)</li>`;
    if (visitadas.has(id)) return `<li>${escapar(id)} (ya mostrado)</li>`;
    visitadas.add(id);
    if (escena.opciones.length === 0) return `<li>${escapar(id)} (final)</li>`;
    const opciones = escena.opciones.map(opcion => `
      <li>${escapar(id)} → ${escapar(opcion.destino || 'Sin destino')} (${escapar(opcion.texto || 'opción sin texto')})
        ${nivel < simulacion.escenas.length ? `<ul>${rama(opcion.destino, nivel + 1)}</ul>` : ''}
      </li>
    `).join('');
    return opciones;
  }

  panel.innerHTML = `
    <h2 id="titulo-mapa" class="tarjeta__titulo">Mapa del escenario</h2>
    <ul>${rama(simulacion.escenaInicial)}</ul>
    ${visitadas.size < simulacion.escenas.length ? `<p class="campo__ayuda">Fuera del recorrido inicial: ${simulacion.escenas.filter(e => !visitadas.has(e.id)).map(e => escapar(e.id)).join(', ')}</p>` : ''}
  `;
}

function validarPublicacion() {
  const errores = [];
  const porId = new Map(simulacion.escenas.map(escena => [escena.id, escena]));
  const agregar = (escenaId, mensaje) => errores.push({ escenaId, mensaje });

  if (!porId.has(simulacion.escenaInicial)) agregar('', 'La escena inicial no existe.');
  if (!simulacion.escenas.some(escena => escena.opciones.length === 0)) agregar('', 'Debe existir al menos una escena final sin opciones.');

  for (const escena of simulacion.escenas) {
    if (!escena.texto.trim()) agregar(escena.id, 'La escena necesita texto.');
    if (escena.opciones.length === 1 || escena.opciones.length > 4) agregar(escena.id, 'Una escena de decisión debe tener entre 2 y 4 opciones.');
    escena.opciones.forEach((opcion, indice) => {
      if (!opcion.texto.trim()) agregar(escena.id, `La opción ${indice + 1} necesita texto.`);
      if (!porId.has(opcion.destino)) agregar(escena.id, `La opción ${indice + 1} tiene un destino inexistente.`);
      if (!opcion.consecuencia.trim()) agregar(escena.id, `La opción ${indice + 1} necesita una consecuencia.`);
      if (!Number.isInteger(Number(opcion.puntos)) || Number(opcion.puntos) < -10 || Number(opcion.puntos) > 10) {
        agregar(escena.id, `La opción ${indice + 1} debe tener puntos entre −10 y 10.`);
      }
    });
  }

  const alcanzables = new Set();
  function recorrer(id) {
    if (alcanzables.has(id) || !porId.has(id)) return;
    alcanzables.add(id);
    porId.get(id).opciones.forEach(opcion => recorrer(opcion.destino));
  }
  recorrer(simulacion.escenaInicial);
  simulacion.escenas.filter(escena => !alcanzables.has(escena.id)).forEach(escena => agregar(escena.id, 'La escena no es alcanzable desde la escena inicial.'));

  const visitando = new Set();
  const procesadas = new Set();
  function tieneCiclo(id) {
    if (visitando.has(id)) return true;
    if (procesadas.has(id) || !porId.has(id)) return false;
    visitando.add(id);
    const ciclo = porId.get(id).opciones.some(opcion => tieneCiclo(opcion.destino));
    visitando.delete(id);
    procesadas.add(id);
    return ciclo;
  }
  if (tieneCiclo(simulacion.escenaInicial)) agregar(simulacion.escenaInicial, 'El recorrido contiene un ciclo.');
  return errores;
}

function mostrarErrores(errores) {
  document.querySelectorAll('.escena--con-error').forEach(el => el.classList.remove('escena--con-error'));
  const panel = document.getElementById('errores-publicacion');
  if (!errores.length) {
    panel.innerHTML = '';
    return;
  }
  panel.innerHTML = `
    <section class="alerta alerta--error errores-publicacion" role="alert">
      <strong>Corrige estos errores antes de publicar:</strong>
      <ul>${errores.map(error => `<li>${error.escenaId ? `<a href="#escena-${escapar(error.escenaId)}">${escapar(error.escenaId)}</a>: ` : ''}${escapar(error.mensaje)}</li>`).join('')}</ul>
    </section>
  `;
  errores.forEach(error => {
    if (error.escenaId) document.getElementById(`escena-${error.escenaId}`)?.classList.add('escena--con-error');
  });
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function guardar() {
  simulacion.titulo = document.getElementById('sim-titulo').value.trim();
  simulacion.temaId = document.getElementById('sim-tema').value;
  simulacion.estado = document.getElementById('sim-estado').value;
  if (!simulacion.titulo || !simulacion.temaId) {
    aviso('El título y el tema son obligatorios.', 'error');
    return;
  }
  if (simulacion.modo === 'rol') {
    const p = simulacion.personaje;
    if (![p.nombre, p.descripcion, p.contexto, p.objetivo].every(valor => String(valor || '').trim())) {
      aviso('Completa todos los datos del personaje y la práctica.', 'error'); return;
    }
    if (simulacion.rubrica.length < 3 || simulacion.rubrica.length > 5 || simulacion.rubrica.some(item => !item.criterio.trim() || !item.descripcion.trim() || Number(item.puntos) <= 0)) {
      aviso('Completa entre 3 y 5 criterios válidos en la rúbrica.', 'error'); return;
    }
  }
  const errores = simulacion.modo === 'escenarios' && simulacion.estado === 'publicado' ? validarPublicacion() : [];
  mostrarErrores(errores);
  if (errores.length) return;

  const datos = {
    titulo: simulacion.titulo,
    temaId: simulacion.temaId,
    modo: simulacion.modo,
    estado: simulacion.estado,
    escenaInicial: simulacion.escenaInicial,
    escenas: simulacion.escenas,
    personaje: simulacion.personaje,
    rubrica: simulacion.rubrica,
    maxTurnos: simulacion.maxTurnos
  };
  cargando(true);
  try {
    const guardada = simulacionId
      ? await actualizar('simulaciones', simulacionId, datos)
      : await crear('simulaciones', datos);
    simulacionId = guardada.id;
    simulacion = normalizarDatos(guardada);
    cambiosSinGuardar = false;
    aviso('Simulación guardada correctamente.', 'exito');
    history.replaceState(null, '', `/paginas/editor-simulacion.html?id=${encodeURIComponent(simulacionId)}`);
    renderizar();
  } catch (error) {
    aviso(error.message || 'No se pudo guardar la simulación.', 'error');
  } finally {
    cargando(false);
  }
}

await cargarEditor();
