// publico/js/modulos/editor-tema.js · Editor de ficha del tema y glosario
import { montarPlantilla } from '../nucleo/plantilla.js';
import { obtener, actualizar, listar, crear, eliminar, subir, ia } from '../nucleo/api.js';
import { aviso, confirmar, modal, escapar, cargando } from '../nucleo/ui.js';
import { parametro, normalizar } from '../nucleo/util.js';

await montarPlantilla({ titulo: "Ficha del Tema", roles: ["docente", "admin"] });

const temaId = parametro('id');
const contenido = document.getElementById('contenido');

if (!temaId) {
  if (contenido) {
    contenido.innerHTML = `
      <div class="tarjeta vacio">
        <div class="vacio__icono">⚠️</div>
        <h2 class="vacio__titulo">Falta el identificador del tema</h2>
        <p class="vacio__texto">Debes acceder desde el editor de contenidos seleccionando un tema.</p>
        <a href="/paginas/editor-contenidos.html" class="btn btn--primario" style="margin-top: var(--espacio-m);">Volver a Contenidos</a>
      </div>
    `;
  }
} else {
  let tema = null;
  let terminosGlosario = [];
  let cambiosSinGuardar = false;

  window.addEventListener('beforeunload', (e) => {
    if (cambiosSinGuardar) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  function contarPalabras(texto) {
    if (!texto) return 0;
    const palabras = texto.trim().split(/\s+/).filter(Boolean);
    return palabras.length;
  }

  function marcarCambio() {
    cambiosSinGuardar = true;
    const btnGuardar = document.getElementById('btn-guardar-tema');
    if (btnGuardar) {
      btnGuardar.classList.remove('btn--secundario');
      btnGuardar.classList.add('btn--acento');
    }
  }

  function limpiarCambio() {
    cambiosSinGuardar = false;
    const btnGuardar = document.getElementById('btn-guardar-tema');
    if (btnGuardar) {
      btnGuardar.classList.remove('btn--acento');
      btnGuardar.classList.add('btn--primario');
    }
  }

  async function cargarTodo() {
    cargando(true);
    try {
      const [resTema, resGlosario] = await Promise.all([
        obtener('temas', temaId),
        listar('glosario', { temaId })
      ]);

      tema = resTema;
      terminosGlosario = Array.isArray(resGlosario) ? resGlosario : [];
      renderizarInterfaz();
    } catch (err) {
      aviso(err.message || 'Error al cargar datos del tema', 'error');
      if (contenido) {
        contenido.innerHTML = `<p style="color: var(--error);">No se pudo cargar la información del tema.</p>`;
      }
    } finally {
      cargando(false);
    }
  }

  function renderizarInterfaz() {
    contenido.innerHTML = `
      <div class="tema-editor-layout">
        <header class="tema-cabecera">
          <div>
            <div class="fila fila--xs" style="align-items: center; margin-bottom: var(--espacio-xs);">
              <a href="/paginas/editor-contenidos.html" class="btn btn--texto btn--pequeno">← Volver a Contenidos</a>
              <span class="insignia insignia--info">Tema #${tema.orden || 1}</span>
            </div>
            <h1 class="tarjeta__titulo" style="margin: 0;" id="vista-titulo-cabecera">${escapar(tema.titulo)}</h1>
          </div>

          <div class="fila fila--s" style="align-items: center;">
            <button type="button" class="btn btn--secundario" id="btn-generar-ia" title="Generar glosario automáticamente con IA">
              ✨ Generar con IA
            </button>
            <button type="button" class="btn btn--primario" id="btn-guardar-tema">
              Guardar Ficha
            </button>
          </div>
        </header>

        <!-- Pestañas -->
        <div class="tema-pestanas" role="tablist">
          <button type="button" class="pestana-btn activa" id="tab-ficha" role="tab" aria-selected="true" aria-controls="panel-ficha">
            Ficha del Tema
          </button>
          <button type="button" class="pestana-btn" id="tab-glosario" role="tab" aria-selected="false" aria-controls="panel-glosario">
            Glosario de Términos (${terminosGlosario.length})
          </button>
        </div>

        <!-- Panel 1: Ficha del Tema -->
        <section id="panel-ficha" class="tarjeta" role="tabpanel" aria-labelledby="tab-ficha">
          <form id="form-ficha-tema" class="pila pila--l" novalidate>
            <div class="fila fila--m" style="gap: var(--espacio-m);">
              <div class="campo" style="flex: 2;">
                <label for="campo-titulo">Título del tema</label>
                <input type="text" id="campo-titulo" required value="${escapar(tema.titulo || '')}">
              </div>
              <div class="campo" style="flex: 1;">
                <label for="campo-estado">Estado</label>
                <select id="campo-estado">
                  <option value="borrador" ${tema.estado === 'borrador' ? 'selected' : ''}>Borrador</option>
                  <option value="publicado" ${tema.estado === 'publicado' ? 'selected' : ''}>Publicado</option>
                </select>
              </div>
              <div class="campo" style="flex: 1;">
                <label for="campo-dificultad">Dificultad</label>
                <select id="campo-dificultad">
                  <option value="basico" ${tema.dificultad === 'basico' ? 'selected' : ''}>Básico</option>
                  <option value="intermedio" ${tema.dificultad === 'intermedio' ? 'selected' : ''}>Intermedio</option>
                  <option value="avanzado" ${tema.dificultad === 'avanzado' ? 'selected' : ''}>Avanzado</option>
                </select>
              </div>
            </div>

            <!-- Resumen con contador -->
            <div class="campo">
              <label for="campo-resumen">Resumen formativo (admite formato básico: **negrita**, listas con -)</label>
              <textarea id="campo-resumen" rows="8" placeholder="Escribe el resumen formativo (recomendado de 300 a 800 palabras)...">${escapar(tema.resumen || '')}</textarea>
              <div class="contador-palabras" id="contador-resumen">
                <span id="cant-palabras-resumen">0</span> palabras (recomendado: 300 - 800)
              </div>
            </div>

            <!-- Objetivos -->
            <div class="campo">
              <div class="fila fila--s" style="justify-content: space-between; align-items: center;">
                <label style="margin: 0;">Objetivos de aprendizaje</label>
                <button type="button" class="btn btn--texto btn--pequeno" id="btn-add-objetivo">+ Agregar objetivo</button>
              </div>
              <div class="lista-dinamica" id="lista-objetivos"></div>
            </div>

            <!-- Ejemplos -->
            <div class="campo">
              <div class="fila fila--s" style="justify-content: space-between; align-items: center;">
                <label style="margin: 0;">Ejemplos clínicos / prácticos</label>
                <button type="button" class="btn btn--texto btn--pequeno" id="btn-add-ejemplo">+ Agregar ejemplo</button>
              </div>
              <div class="lista-dinamica" id="lista-ejemplos"></div>
            </div>

            <!-- Errores frecuentes -->
            <div class="campo">
              <div class="fila fila--s" style="justify-content: space-between; align-items: center;">
                <label style="margin: 0;">Errores frecuentes</label>
                <button type="button" class="btn btn--texto btn--pequeno" id="btn-add-error">+ Agregar error frecuente</button>
              </div>
              <div class="lista-dinamica" id="lista-errores"></div>
            </div>

            <!-- Preguntas guía -->
            <div class="campo">
              <div class="fila fila--s" style="justify-content: space-between; align-items: center;">
                <label style="margin: 0;">Preguntas guía socráticas</label>
                <button type="button" class="btn btn--texto btn--pequeno" id="btn-add-pregunta">+ Agregar pregunta guía</button>
              </div>
              <div class="lista-dinamica" id="lista-preguntas"></div>
            </div>

            <!-- Recursos -->
            <div class="campo">
              <div class="fila fila--s" style="justify-content: space-between; align-items: center;">
                <label style="margin: 0;">Recursos complementarios (vídeo, pdf, imagen o enlace)</label>
                <button type="button" class="btn btn--texto btn--pequeno" id="btn-add-recurso">+ Agregar recurso</button>
              </div>
              <div class="lista-dinamica" id="lista-recursos" style="margin-top: var(--espacio-s);"></div>
            </div>

            <!-- Metadatos finales -->
            <div class="fila fila--m" style="gap: var(--espacio-m);">
              <div class="campo" style="flex: 1;">
                <label for="campo-palabras-clave">Palabras clave (separadas por comas)</label>
                <input type="text" id="campo-palabras-clave" placeholder="trauma, via-aerea, soporte..." value="${escapar(Array.isArray(tema.palabrasClave) ? tema.palabrasClave.join(', ') : (tema.palabrasClave || ''))}">
              </div>
              <div class="campo" style="flex: 1;">
                <label for="campo-fuentes">Fuentes bibliográficas</label>
                <input type="text" id="campo-fuentes" placeholder="Manual ATLS, Guías AHA..." value="${escapar(tema.fuentes || '')}">
              </div>
            </div>
          </form>
        </section>

        <!-- Panel 2: Glosario -->
        <section id="panel-glosario" class="tarjeta" role="tabpanel" aria-labelledby="tab-glosario" hidden>
          <div class="fila fila--m" style="justify-content: space-between; align-items: center; margin-bottom: var(--espacio-m);">
            <div>
              <h2 class="tarjeta__titulo" style="font-size: var(--tamano-m); margin: 0;">Glosario del Tema</h2>
              <p class="tarjeta__subtitulo" style="margin: 0;">Términos clave para evaluación formativa y minijuegos didácticos</p>
            </div>
            <button type="button" class="btn btn--primario btn--pequeno" id="btn-nuevo-termino">
              + Nuevo Término
            </button>
          </div>

          <div class="glosario-metricas" id="metricas-glosario"></div>

          <div class="tabla-usuarios-contenedor">
            <table class="tabla" id="tabla-glosario" aria-label="Términos del glosario">
              <thead>
                <tr>
                  <th>Término</th>
                  <th>Definición (hasta 25 pal.)</th>
                  <th>Pista (hasta 10 pal.)</th>
                  <th>Retroalimentación</th>
                  <th style="text-align: right;">Acciones</th>
                </tr>
              </thead>
              <tbody id="cuerpo-tabla-glosario"></tbody>
            </table>
          </div>
        </section>
      </div>
    `;

    inicializarPestanas();
    inicializarFicha();
    inicializarGlosario();
  }

  function inicializarPestanas() {
    const tabFicha = document.getElementById('tab-ficha');
    const tabGlosario = document.getElementById('tab-glosario');
    const panelFicha = document.getElementById('panel-ficha');
    const panelGlosario = document.getElementById('panel-glosario');

    tabFicha.addEventListener('click', () => {
      tabFicha.classList.add('activa');
      tabFicha.setAttribute('aria-selected', 'true');
      tabGlosario.classList.remove('activa');
      tabGlosario.setAttribute('aria-selected', 'false');
      panelFicha.hidden = false;
      panelGlosario.hidden = true;
    });

    tabGlosario.addEventListener('click', () => {
      tabGlosario.classList.add('activa');
      tabGlosario.setAttribute('aria-selected', 'true');
      tabFicha.classList.remove('activa');
      tabFicha.setAttribute('aria-selected', 'false');
      panelGlosario.hidden = false;
      panelFicha.hidden = true;
    });
  }

  function inicializarFicha() {
    const resumenEl = document.getElementById('campo-resumen');
    const cantPalabrasEl = document.getElementById('cant-palabras-resumen');
    const contPalabrasEl = document.getElementById('contador-resumen');

    function actualizarContadorResumen() {
      const cantidad = contarPalabras(resumenEl.value);
      cantPalabrasEl.textContent = cantidad;
      if (cantidad >= 300 && cantidad <= 800) {
        contPalabrasEl.className = 'contador-palabras valido';
      } else {
        contPalabrasEl.className = 'contador-palabras invalido';
      }
    }

    resumenEl.addEventListener('input', () => {
      actualizarContadorResumen();
      marcarCambio();
    });
    actualizarContadorResumen();

    ['campo-titulo', 'campo-estado', 'campo-dificultad', 'campo-palabras-clave', 'campo-fuentes'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', marcarCambio);
    });

    // Listas dinámicas simples (Objetivos, Ejemplos, Errores, Preguntas)
    montarListaDinamica('lista-objetivos', 'btn-add-objetivo', tema.objetivos || [], 'Objetivo de aprendizaje...');
    montarListaDinamica('lista-ejemplos', 'btn-add-ejemplo', tema.ejemplos || [], 'Ejemplo práctico...');
    montarListaDinamica('lista-errores', 'btn-add-error', tema.erroresFrecuentes || [], 'Error común...');
    montarListaDinamica('lista-preguntas', 'btn-add-pregunta', tema.preguntasGuia || [], 'Pregunta socrática...');

    // Lista de Recursos con soporte de subida
    montarListaRecursos('lista-recursos', 'btn-add-recurso', tema.recursos || []);

    // Guardar cambios
    document.getElementById('btn-guardar-tema').addEventListener('click', guardarFicha);
  }

  function montarListaDinamica(contenedorId, botonId, itemsIniciales, placeholder) {
    const contenedor = document.getElementById(contenedorId);
    const boton = document.getElementById(botonId);

    function agregarItem(valor = '') {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'item-dinamico';
      itemDiv.innerHTML = `
        <span style="color: var(--texto-suave);">•</span>
        <input type="text" placeholder="${escapar(placeholder)}" value="${escapar(valor)}">
        <button type="button" class="btn btn--texto btn--pequeno" style="color: var(--error);" title="Eliminar">✕</button>
      `;

      const input = itemDiv.querySelector('input');
      const btnEliminar = itemDiv.querySelector('button');

      input.addEventListener('input', marcarCambio);
      btnEliminar.addEventListener('click', () => {
        itemDiv.remove();
        marcarCambio();
      });

      contenedor.appendChild(itemDiv);
    }

    boton.addEventListener('click', () => {
      agregarItem();
      marcarCambio();
    });

    itemsIniciales.forEach(txt => agregarItem(txt));
  }

  function montarListaRecursos(contenedorId, botonId, recursosIniciales) {
    const contenedor = document.getElementById(contenedorId);
    const boton = document.getElementById(botonId);

    function agregarRecurso(rec = { tipo: 'enlace', titulo: '', url: '' }) {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'recurso-item';
      itemDiv.innerHTML = `
        <select class="rec-tipo">
          <option value="enlace" ${rec.tipo === 'enlace' ? 'selected' : ''}>Enlace</option>
          <option value="video" ${rec.tipo === 'video' ? 'selected' : ''}>Vídeo</option>
          <option value="pdf" ${rec.tipo === 'pdf' ? 'selected' : ''}>PDF</option>
          <option value="imagen" ${rec.tipo === 'imagen' ? 'selected' : ''}>Imagen</option>
        </select>
        <input type="text" class="rec-titulo" placeholder="Título del recurso..." value="${escapar(rec.titulo || '')}">
        <input type="text" class="rec-url" placeholder="URL o archivo..." value="${escapar(rec.url || '')}">
        <div class="rec-subir-wrapper">
          <label class="btn btn--secundario btn--pequeno btn-subir-rec" style="display: ${rec.tipo === 'pdf' || rec.tipo === 'imagen' ? 'inline-flex' : 'none'}; cursor: pointer;">
            Subir
            <input type="file" style="display: none;" class="input-archivo-rec">
          </label>
        </div>
        <button type="button" class="btn btn--texto btn--pequeno" style="color: var(--error);" title="Quitar recurso">✕</button>
      `;

      const tipoSelect = itemDiv.querySelector('.rec-tipo');
      const tituloInput = itemDiv.querySelector('.rec-titulo');
      const urlInput = itemDiv.querySelector('.rec-url');
      const subirBtn = itemDiv.querySelector('.btn-subir-rec');
      const fileInput = itemDiv.querySelector('.input-archivo-rec');
      const quitarBtn = itemDiv.querySelector('button[title="Quitar recurso"]');

      tipoSelect.addEventListener('change', () => {
        const esArchivo = tipoSelect.value === 'pdf' || tipoSelect.value === 'imagen';
        subirBtn.style.display = esArchivo ? 'inline-flex' : 'none';
        fileInput.accept = tipoSelect.value === 'pdf' ? 'application/pdf' : 'image/jpeg,image/png,image/webp';
        marcarCambio();
      });

      tituloInput.addEventListener('input', marcarCambio);
      urlInput.addEventListener('input', marcarCambio);

      fileInput.addEventListener('change', async (e) => {
        const archivo = e.target.files && e.target.files[0];
        if (!archivo) return;
        try {
          aviso('Subiendo archivo...', 'info');
          const res = await subir(archivo);
          if (res && res.url) {
            urlInput.value = res.url;
            if (!tituloInput.value.trim()) {
              tituloInput.value = archivo.name;
            }
            aviso('Archivo subido con éxito.', 'exito');
            marcarCambio();
          }
        } catch (err) {
          aviso(err.message || 'Error al subir archivo', 'error');
        }
      });

      quitarBtn.addEventListener('click', () => {
        itemDiv.remove();
        marcarCambio();
      });

      contenedor.appendChild(itemDiv);
    }

    boton.addEventListener('click', () => {
      agregarRecurso();
      marcarCambio();
    });

    recursosIniciales.forEach(r => agregarRecurso(r));
  }

  async function guardarFicha() {
    const titulo = document.getElementById('campo-titulo').value.trim();
    if (!titulo) {
      aviso('El título del tema es obligatorio.', 'error');
      return;
    }

    const estado = document.getElementById('campo-estado').value;
    const dificultad = document.getElementById('campo-dificultad').value;
    const resumen = document.getElementById('campo-resumen').value;
    const fuentes = document.getElementById('campo-fuentes').value.trim();

    const palabrasRaw = document.getElementById('campo-palabras-clave').value;
    const palabrasClave = palabrasRaw.split(',').map(p => p.trim()).filter(Boolean);

    // Extraer de listas
    const objetivos = Array.from(document.querySelectorAll('#lista-objetivos input')).map(i => i.value.trim()).filter(Boolean);
    const ejemplos = Array.from(document.querySelectorAll('#lista-ejemplos input')).map(i => i.value.trim()).filter(Boolean);
    const erroresFrecuentes = Array.from(document.querySelectorAll('#lista-errores input')).map(i => i.value.trim()).filter(Boolean);
    const preguntasGuia = Array.from(document.querySelectorAll('#lista-preguntas input')).map(i => i.value.trim()).filter(Boolean);

    const recursos = Array.from(document.querySelectorAll('#lista-recursos .recurso-item')).map(item => ({
      tipo: item.querySelector('.rec-tipo').value,
      titulo: item.querySelector('.rec-titulo').value.trim(),
      url: item.querySelector('.rec-url').value.trim()
    })).filter(r => r.titulo && r.url);

    const cambios = {
      titulo,
      estado,
      dificultad,
      resumen,
      fuentes,
      palabrasClave,
      objetivos,
      ejemplos,
      erroresFrecuentes,
      preguntasGuia,
      recursos
    };

    try {
      cargando(true);
      await actualizar('temas', tema.id, cambios);
      tema = { ...tema, ...cambios };
      document.getElementById('vista-titulo-cabecera').textContent = titulo;
      limpiarCambio();
      aviso('Ficha del tema guardada correctamente.', 'exito');
    } catch (err) {
      aviso(err.message || 'Error al guardar el tema', 'error');
    } finally {
      cargando(false);
    }
  }

  // --- MÓDULO DE GLOSARIO ---
  async function revisarPropuestasIa(propuestas) {
    const existentes = new Set(terminosGlosario.map(item => normalizar(item.termino)));
    const formulario = document.createElement('form');
    formulario.className = 'propuestas-ia';
    formulario.innerHTML = `
      <p class="campo__ayuda">Edita las propuestas y marca únicamente las que deseas incorporar.</p>
      <div class="propuestas-ia__tabla">
        <table class="tabla" aria-label="Propuestas de glosario generadas con IA">
          <thead>
            <tr>
              <th scope="col">Aprobar</th>
              <th scope="col">Término</th>
              <th scope="col">Definición</th>
              <th scope="col">Pista</th>
              <th scope="col">Retroalimentación</th>
            </tr>
          </thead>
          <tbody>
            ${propuestas.map((item, indice) => {
              const repetida = existentes.has(normalizar(item.termino));
              return `
                <tr class="propuesta-ia${repetida ? ' propuesta-ia--repetida' : ''}" data-indice="${indice}">
                  <td>
                    <input type="checkbox" class="propuesta-ia__seleccion" ${repetida ? '' : 'checked'} aria-label="Aprobar término ${escapar(item.termino)}">
                    <span class="propuesta-ia__estado">${repetida ? 'Repetido' : ''}</span>
                  </td>
                  <td><input type="text" data-campo="termino" value="${escapar(item.termino)}" aria-label="Término propuesto ${indice + 1}" required></td>
                  <td><textarea data-campo="definicion" aria-label="Definición propuesta ${indice + 1}" required>${escapar(item.definicion)}</textarea></td>
                  <td><textarea data-campo="pista" aria-label="Pista propuesta ${indice + 1}">${escapar(item.pista || '')}</textarea></td>
                  <td><textarea data-campo="retroalimentacion" aria-label="Retroalimentación propuesta ${indice + 1}">${escapar(item.retroalimentacion || '')}</textarea></td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    formulario.querySelectorAll('.propuesta-ia').forEach(fila => {
      const termino = fila.querySelector('[data-campo="termino"]');
      const seleccion = fila.querySelector('.propuesta-ia__seleccion');
      const estado = fila.querySelector('.propuesta-ia__estado');
      termino.addEventListener('input', () => {
        const repetida = existentes.has(normalizar(termino.value));
        fila.classList.toggle('propuesta-ia--repetida', repetida);
        estado.textContent = repetida ? 'Repetido' : '';
        if (repetida) seleccion.checked = false;
      });
    });

    const aprobar = await modal({
      titulo: 'Revisar propuestas de IA',
      contenido: formulario,
      acciones: [
        { texto: 'Cancelar', valor: false, clase: 'btn--secundario' },
        { texto: 'Aprobar seleccionados', valor: true, clase: 'btn--primario' }
      ]
    });
    if (!aprobar) return;

    const seleccionadas = [...formulario.querySelectorAll('.propuesta-ia')]
      .filter(fila => fila.querySelector('.propuesta-ia__seleccion').checked)
      .map(fila => ({
        termino: fila.querySelector('[data-campo="termino"]').value.trim(),
        definicion: fila.querySelector('[data-campo="definicion"]').value.trim(),
        pista: fila.querySelector('[data-campo="pista"]').value.trim(),
        retroalimentacion: fila.querySelector('[data-campo="retroalimentacion"]').value.trim()
      }))
      .filter(item => item.termino && item.definicion && !existentes.has(normalizar(item.termino)));

    if (seleccionadas.length === 0) {
      aviso('Selecciona al menos una propuesta no repetida con término y definición.', 'error');
      return;
    }

    cargando(true);
    let guardados = 0;
    try {
      for (const item of seleccionadas) {
        try {
          const nuevo = await crear('glosario', {
            temaId: tema.id,
            ...item,
            origen: 'ia',
            estado: 'aprobado'
          });
          terminosGlosario.push(nuevo);
          existentes.add(normalizar(nuevo.termino));
          guardados++;
        } catch (errItem) {
          console.warn('No se pudo aprobar una propuesta de IA:', errItem);
        }
      }
      renderizarTablaGlosario();
      document.getElementById('tab-glosario')?.click();
      aviso(`${guardados} término(s) aprobados e incorporados al glosario.`, guardados ? 'exito' : 'error');
    } finally {
      cargando(false);
    }
  }

  function inicializarGlosario() {
    renderizarTablaGlosario();
    document.getElementById('btn-nuevo-termino').addEventListener('click', () => abrirModalTermino());

    const btnGenerarIa = document.getElementById('btn-generar-ia');
    if (btnGenerarIa) {
      btnGenerarIa.addEventListener('click', async () => {
        const formIa = document.createElement('form');
        formIa.className = 'pila pila--m';
        formIa.innerHTML = `
          <p>La IA generará términos clave con su definición, pista y retroalimentación pedagógica a partir del contenido de este tema.</p>
          <div class="campo">
            <label for="cant-ia-glosario">Cantidad de términos a generar (5 a 20):</label>
            <input type="number" id="cant-ia-glosario" min="5" max="20" value="10" class="campo__entrada">
          </div>
          <small class="campo__ayuda">Al menos 3 términos tendrán 6 letras o más para habilitar los minijuegos didácticos.</small>
        `;

        const confirmarModal = await modal({
          titulo: '✨ Generar Glosario con IA',
          contenido: formIa,
          acciones: [
            { texto: 'Cancelar', valor: false, clase: 'btn-secundario' },
            { texto: 'Generar Ahora', valor: true, clase: 'btn-primario' }
          ]
        });

        if (!confirmarModal) return;

        const inputCant = formIa.querySelector('#cant-ia-glosario');
        const cantidad = parseInt(inputCant?.value || '10', 10);

        cargando(true);
        try {
          if (!Number.isInteger(cantidad) || cantidad < 5 || cantidad > 20) {
            throw new Error('La cantidad debe estar entre 5 y 20');
          }

          const resultado = await ia('generar-glosario', {
            temaId: tema.id,
            cantidad
          });

          if (!Array.isArray(resultado) || resultado.length === 0) {
            throw new Error('La IA no devolvió términos válidos');
          }

          cargando(false);
          await revisarPropuestasIa(resultado);
        } catch (errIa) {
          console.error('Error al generar glosario con IA:', errIa);
          aviso(errIa.message || 'No se pudo generar el glosario con IA', 'error');
        } finally {
          cargando(false);
        }
      });
    }
  }

  function renderizarTablaGlosario() {
    const cuerpo = document.getElementById('cuerpo-tabla-glosario');
    const metricas = document.getElementById('metricas-glosario');
    const tabGlosario = document.getElementById('tab-glosario');
    if (tabGlosario) {
      tabGlosario.textContent = `Glosario de Términos (${terminosGlosario.length})`;
    }

    // Cálculo de métricas
    const totalTerminos = terminosGlosario.length;
    const terminos6Letras = terminosGlosario.filter(t => normalizar(t.termino).length === 6).length;
    const aptoJuegos = totalTerminos >= 12 && terminos6Letras >= 3;

    metricas.innerHTML = `
      <div class="metrica-card">
        <strong>${totalTerminos}</strong>
        <span>Términos totales (mín. 12)</span>
      </div>
      <div class="metrica-card">
        <strong>${terminos6Letras}</strong>
        <span>Palabras de 6 letras (mín. 3)</span>
      </div>
      <div class="metrica-card" style="margin-left: auto;">
        <span class="insignia ${aptoJuegos ? 'insignia--exito' : 'insignia--advertencia'}" style="font-size: var(--tamano-s); padding: 6px 12px;">
          ${aptoJuegos ? '🎮 Apto para juegos' : '⚠️ No apto para juegos aún'}
        </span>
      </div>
    `;

    if (totalTerminos === 0) {
      cuerpo.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--texto-suave); padding: var(--espacio-l);">
            No hay términos en el glosario para este tema. Pulsa "+ Nuevo Término" para añadir.
          </td>
        </tr>
      `;
      return;
    }

    cuerpo.innerHTML = terminosGlosario.map(term => {
      const longTermino = normalizar(term.termino).length;
      return `
        <tr data-id="${escapar(term.id)}">
          <td>
            <strong>${escapar(term.termino)}</strong>
            ${longTermino === 6 ? '<span class="chip" style="margin-left: 4px; font-size: 10px;">6 letras</span>' : ''}
            ${term.origen === 'ia' ? '<span class="insignia insignia--acento">Generado con IA</span>' : ''}
          </td>
          <td style="max-width: 280px; font-size: var(--tamano-s);">${escapar(term.definicion)}</td>
          <td style="max-width: 200px; font-size: var(--tamano-s); color: var(--texto-suave);">${escapar(term.pista || '')}</td>
          <td style="max-width: 200px; font-size: var(--tamano-s);">${escapar(term.retroalimentacion || '')}</td>
          <td style="text-align: right; white-space: nowrap;">
            <button type="button" class="btn btn--secundario btn--pequeno btn-editar-term" data-id="${escapar(term.id)}">
              Editar
            </button>
            <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar-term" data-id="${escapar(term.id)}" data-termino="${escapar(term.termino)}">
              Eliminar
            </button>
          </td>
        </tr>
      `;
    }).join('');

    vincularEventosGlosario();
  }

  function vincularEventosGlosario() {
    const cuerpo = document.getElementById('cuerpo-tabla-glosario');

    cuerpo.querySelectorAll('.btn-editar-term').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const term = terminosGlosario.find(t => t.id === id);
        if (term) abrirModalTermino(term);
      });
    });

    cuerpo.querySelectorAll('.btn-eliminar-term').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const palabra = btn.dataset.termino;

        const confirmado = await confirmar(`¿Seguro que deseas eliminar el término "${palabra}"?`);
        if (!confirmado) return;

        try {
          cargando(true);
          await eliminar('glosario', id);
          terminosGlosario = terminosGlosario.filter(t => t.id !== id);
          renderizarTablaGlosario();
          aviso('Término eliminado del glosario.', 'exito');
        } catch (err) {
          aviso(err.message || 'Error al eliminar término', 'error');
        } finally {
          cargando(false);
        }
      });
    });
  }

  function abrirModalTermino(termino = null) {
    const esEdicion = Boolean(termino);
    const form = document.createElement('form');
    form.className = 'pila pila--m';
    form.noValidate = true;

    form.innerHTML = `
      <div class="campo">
        <label for="glos-termino">Término (una sola palabra)</label>
        <input type="text" id="glos-termino" required placeholder="Ej: Trauma, Triage..." value="${escapar(esEdicion ? termino.termino : '')}">
        <small class="campo__ayuda" id="ayuda-letras">Longitud normalizada: 0 letras</small>
      </div>

      <div class="campo">
        <label for="glos-definicion">Definición (hasta 25 palabras)</label>
        <textarea id="glos-definicion" rows="3" required placeholder="Explicación clara y concisa...">${escapar(esEdicion ? termino.definicion : '')}</textarea>
        <div class="contador-palabras" id="cont-def">0 / 25 palabras</div>
      </div>

      <div class="campo">
        <label for="glos-pista">Pista didáctica (hasta 10 palabras)</label>
        <input type="text" id="glos-pista" placeholder="Indicio breve para los juegos..." value="${escapar(esEdicion ? (termino.pista || '') : '')}">
        <div class="contador-palabras" id="cont-pista">0 / 10 palabras</div>
      </div>

      <div class="campo">
        <label for="glos-retro">Retroalimentación pedagógica</label>
        <textarea id="glos-retro" rows="2" placeholder="Por qué es importante este término clínico...">${escapar(esEdicion ? (termino.retroalimentacion || '') : '')}</textarea>
      </div>
    `;

    const inputTermino = form.querySelector('#glos-termino');
    const inputDef = form.querySelector('#glos-definicion');
    const inputPista = form.querySelector('#glos-pista');
    const inputRetro = form.querySelector('#glos-retro');
    const ayudaLetras = form.querySelector('#ayuda-letras');
    const contDef = form.querySelector('#cont-def');
    const contPista = form.querySelector('#cont-pista');

    function actualizarContadoresModal() {
      const norm = normalizar(inputTermino.value.trim());
      ayudaLetras.textContent = `Longitud normalizada: ${norm.length} letra(s)${norm.length === 6 ? ' (¡cumple con las 6 letras!)' : ''}`;

      const palDef = contarPalabras(inputDef.value);
      contDef.textContent = `${palDef} / 25 palabras`;
      contDef.className = `contador-palabras ${palDef <= 25 ? 'valido' : 'invalido'}`;

      const palPista = contarPalabras(inputPista.value);
      contPista.textContent = `${palPista} / 10 palabras`;
      contPista.className = `contador-palabras ${palPista <= 10 ? 'valido' : 'invalido'}`;
    }

    inputTermino.addEventListener('input', actualizarContadoresModal);
    inputDef.addEventListener('input', actualizarContadoresModal);
    inputPista.addEventListener('input', actualizarContadoresModal);
    actualizarContadoresModal();

    modal({
      titulo: esEdicion ? 'Editar Término del Glosario' : 'Nuevo Término',
      contenido: form,
      acciones: [
        { texto: 'Cancelar', valor: false, clase: 'btn-secundario' },
        { texto: esEdicion ? 'Guardar Cambios' : 'Añadir Término', valor: true, clase: 'btn-primario' }
      ]
    }).then(async (guardar) => {
      if (!guardar) return;

      const palTermino = inputTermino.value.trim();
      const definicion = inputDef.value.trim();
      const pista = inputPista.value.trim();
      const retroalimentacion = inputRetro.value.trim();

      if (!palTermino || !definicion) {
        aviso('El término y la definición son obligatorios.', 'error');
        return;
      }

      if (palTermino.includes(' ')) {
        aviso('El término debe ser de una sola palabra.', 'error');
        return;
      }

      if (contarPalabras(definicion) > 25) {
        aviso('La definición no debe superar las 25 palabras.', 'error');
        return;
      }

      if (pista && contarPalabras(pista) > 10) {
        aviso('La pista no debe superar las 10 palabras.', 'error');
        return;
      }

      const datosTermino = {
        temaId,
        termino: palTermino,
        definicion,
        pista,
        retroalimentacion,
        origen: 'docente',
        estado: 'aprobado'
      };

      try {
        cargando(true);
        if (esEdicion) {
          const res = await actualizar('glosario', termino.id, datosTermino);
          const idx = terminosGlosario.findIndex(t => t.id === termino.id);
          if (idx !== -1) terminosGlosario[idx] = res;
          aviso('Término actualizado con éxito.', 'exito');
        } else {
          const res = await crear('glosario', datosTermino);
          terminosGlosario.push(res);
          aviso('Término añadido al glosario.', 'exito');
        }
        renderizarTablaGlosario();
      } catch (err) {
        aviso(err.message || 'Error al guardar término en glosario', 'error');
      } finally {
        cargando(false);
      }
    });
  }

  await cargarTodo();
}
