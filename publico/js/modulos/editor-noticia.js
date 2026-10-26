// publico/js/modulos/editor-noticia.js · Editor de noticias con vista previa interactiva
import { montarPlantilla } from '../nucleo/plantilla.js';
import { obtener, crear, actualizar, listar, subir } from '../nucleo/api.js';
import { aviso, escapar, cargando } from '../nucleo/ui.js';
import { parametro, formatoBasico } from '../nucleo/util.js';

await montarPlantilla({ titulo: "Editor de Noticia", roles: ["docente", "admin"] });

const noticiaId = parametro('id');
const contenido = document.getElementById('contenido');

if (contenido) {
  let noticia = null;
  let temas = [];

  contenido.innerHTML = `
    <div class="tarjeta">
      <div class="fila fila--m" style="justify-content: space-between; align-items: center; margin-bottom: var(--espacio-l); flex-wrap: wrap; gap: var(--espacio-m);">
        <div>
          <a href="/paginas/noticias.html" class="btn btn--texto btn--pequeno" style="padding-left: 0;">← Volver al Portal de Noticias</a>
          <h1 class="tarjeta__titulo" style="margin-top: var(--espacio-xs);" id="titulo-pagina-editor">
            ${noticiaId ? 'Editar Noticia' : 'Nueva Noticia'}
          </h1>
        </div>
        <button type="button" class="btn btn--primario" id="btn-guardar-noticia">
          ${noticiaId ? 'Guardar Cambios' : 'Publicar / Guardar'}
        </button>
      </div>

      <div class="editor-noticia-layout">
        <!-- Formulario de Edición -->
        <form id="form-noticia" class="pila pila--m" novalidate>
          <div class="campo">
            <label for="noticia-titulo">Título de la noticia</label>
            <input type="text" id="noticia-titulo" required placeholder="Titular atractivo y descriptivo...">
          </div>

          <div class="fila fila--m" style="gap: var(--espacio-m);">
            <div class="campo" style="flex: 1;">
              <label for="noticia-categoria">Categoría</label>
              <select id="noticia-categoria">
                <option value="Institucional">Institucional</option>
                <option value="Académica">Académica</option>
                <option value="Eventos">Eventos</option>
                <option value="Logros">Logros</option>
              </select>
            </div>
            <div class="campo" style="flex: 1;">
              <label for="noticia-tema">Tema relacionado (opcional)</label>
              <select id="noticia-tema">
                <option value="">Ninguno</option>
              </select>
            </div>
          </div>

          <div class="campo">
            <label for="noticia-resumen">Resumen (máximo 200 caracteres)</label>
            <textarea id="noticia-resumen" rows="3" maxlength="200" placeholder="Breve introducción o copete para la tarjeta..."></textarea>
            <div class="contador-caracteres" id="contador-resumen">0 / 200 caracteres</div>
          </div>

          <div class="campo">
            <label for="noticia-imagen">Imagen de portada</label>
            <div class="fila fila--s" style="align-items: center;">
              <input type="text" id="noticia-imagen" placeholder="/recursos/subidas/... o URL de imagen" style="flex: 1;">
              <label class="btn btn--secundario btn--pequeno" style="cursor: pointer;">
                Subir
                <input type="file" id="input-archivo-imagen" accept="image/jpeg,image/png,image/webp" style="display: none;">
              </label>
            </div>
          </div>

          <div class="campo">
            <label for="noticia-cuerpo">Cuerpo de la noticia (admite **negrita** y listas con -)</label>
            <textarea id="noticia-cuerpo" rows="10" placeholder="Redacta el contenido completo de la noticia..."></textarea>
          </div>

          <div class="fila fila--m" style="gap: var(--espacio-m); align-items: center;">
            <div class="campo campo--casilla" style="flex: 1;">
              <input type="checkbox" id="noticia-destacada">
              <label for="noticia-destacada">Noticia destacada (aparece primero)</label>
            </div>

            <div class="campo" style="flex: 1;">
              <label for="noticia-estado">Estado</label>
              <select id="noticia-estado">
                <option value="borrador">Borrador</option>
                <option value="publicado">Publicado</option>
              </select>
            </div>
          </div>
        </form>

        <!-- Vista Previa en Vivo -->
        <aside class="noticia-preview-box" aria-label="Vista previa de la noticia">
          <div class="fila fila--s" style="justify-content: space-between; align-items: center;">
            <span class="insignia insignia--secundario" id="prev-categoria">Institucional</span>
            <span class="insignia insignia--acento" id="prev-destacada" style="display: none;">⭐ Destacada</span>
          </div>

          <img src="/recursos/subidas/placeholder.jpg" alt="" class="noticia-preview-img" id="prev-imagen" style="display: none;">

          <div>
            <h2 class="tarjeta__titulo" style="font-size: var(--tamano-l); margin: 0;" id="prev-titulo">
              Título de la Noticia
            </h2>
            <p style="font-size: var(--tamano-s); color: var(--texto-suave); font-weight: var(--peso-medio); margin-top: var(--espacio-xs);" id="prev-resumen">
              El resumen de la noticia se mostrará aquí...
            </p>
          </div>

          <hr style="border: none; border-top: 1px solid var(--borde); margin: 0;">

          <div class="tema-resumen-cuerpo" id="prev-cuerpo" style="font-size: var(--tamano-s);">
            <p style="color: var(--texto-suave);">El cuerpo con formato enriquecido se visualizará aquí en tiempo real.</p>
          </div>
        </aside>
      </div>
    </div>
  `;

  const inputTitulo = document.getElementById('noticia-titulo');
  const selectCat = document.getElementById('noticia-categoria');
  const selectTema = document.getElementById('noticia-tema');
  const inputResumen = document.getElementById('noticia-resumen');
  const inputImagen = document.getElementById('noticia-imagen');
  const inputFile = document.getElementById('input-archivo-imagen');
  const inputCuerpo = document.getElementById('noticia-cuerpo');
  const chkDestacada = document.getElementById('noticia-destacada');
  const selectEstado = document.getElementById('noticia-estado');
  const contadorResumen = document.getElementById('contador-resumen');
  const btnGuardar = document.getElementById('btn-guardar-noticia');

  // Elementos de la vista previa
  const prevCat = document.getElementById('prev-categoria');
  const prevDest = document.getElementById('prev-destacada');
  const prevImg = document.getElementById('prev-imagen');
  const prevTitulo = document.getElementById('prev-titulo');
  const prevResumen = document.getElementById('prev-resumen');
  const prevCuerpo = document.getElementById('prev-cuerpo');

  function actualizarVistaPrevia() {
    prevTitulo.textContent = inputTitulo.value.trim() || 'Título de la Noticia';
    prevCat.textContent = selectCat.value;
    prevDest.style.display = chkDestacada.checked ? 'inline-block' : 'none';
    prevResumen.textContent = inputResumen.value.trim() || 'El resumen de la noticia se mostrará aquí...';

    const urlImg = inputImagen.value.trim();
    if (urlImg) {
      prevImg.src = urlImg;
      prevImg.style.display = 'block';
    } else {
      prevImg.style.display = 'none';
    }

    const cuerpoTxt = inputCuerpo.value.trim();
    if (cuerpoTxt) {
      prevCuerpo.innerHTML = formatoBasico(cuerpoTxt);
    } else {
      prevCuerpo.innerHTML = `<p style="color: var(--texto-suave);">El cuerpo con formato enriquecido se visualizará aquí en tiempo real.</p>`;
    }

    contadorResumen.textContent = `${inputResumen.value.length} / 200 caracteres`;
  }

  [inputTitulo, selectCat, inputResumen, inputImagen, inputCuerpo, chkDestacada, selectEstado].forEach(el => {
    el.addEventListener('input', actualizarVistaPrevia);
    el.addEventListener('change', actualizarVistaPrevia);
  });

  inputFile.addEventListener('change', async (e) => {
    const arch = e.target.files && e.target.files[0];
    if (!arch) return;
    try {
      aviso('Subiendo imagen de portada...', 'info');
      const res = await subir(arch);
      if (res && res.url) {
        inputImagen.value = res.url;
        actualizarVistaPrevia();
        aviso('Imagen subida con éxito.', 'exito');
      }
    } catch (err) {
      aviso(err.message || 'Error al subir imagen', 'error');
    }
  });

  async function cargarDatos() {
    cargando(true);
    try {
      const listaTemas = await listar('temas');
      temas = Array.isArray(listaTemas) ? listaTemas : [];

      selectTema.innerHTML = `
        <option value="">Ninguno</option>
        ${temas.map(t => `<option value="${escapar(t.id)}">${escapar(t.titulo)}</option>`).join('')}
      `;

      if (noticiaId) {
        noticia = await obtener('noticias', noticiaId);
        if (noticia) {
          inputTitulo.value = noticia.titulo || '';
          selectCat.value = noticia.categoria || 'Institucional';
          selectTema.value = noticia.temaId || '';
          inputResumen.value = noticia.resumen || '';
          inputImagen.value = noticia.imagen || '';
          inputCuerpo.value = noticia.cuerpo || '';
          chkDestacada.checked = Boolean(noticia.destacada);
          selectEstado.value = noticia.estado || 'borrador';
          actualizarVistaPrevia();
        }
      }
    } catch (err) {
      aviso(err.message || 'Error al cargar los datos', 'error');
    } finally {
      cargando(false);
    }
  }

  btnGuardar.addEventListener('click', async () => {
    const titulo = inputTitulo.value.trim();
    const resumen = inputResumen.value.trim();
    const cuerpo = inputCuerpo.value.trim();
    const categoria = selectCat.value;
    const temaRel = selectTema.value || null;
    const imagen = inputImagen.value.trim() || null;
    const destacada = chkDestacada.checked;
    const estado = selectEstado.value;

    if (!titulo || !resumen || !cuerpo) {
      aviso('Título, resumen y cuerpo son campos obligatorios.', 'error');
      return;
    }

    const payload = {
      titulo,
      resumen,
      cuerpo,
      categoria,
      temaId: temaRel,
      imagen,
      destacada,
      estado
    };

    try {
      cargando(true);
      if (noticiaId) {
        await actualizar('noticias', noticiaId, payload);
        aviso('Noticia actualizada con éxito.', 'exito');
      } else {
        await crear('noticias', payload);
        aviso('Noticia guardada con éxito.', 'exito');
      }
      setTimeout(() => {
        window.location.href = '/paginas/noticias.html';
      }, 1000);
    } catch (err) {
      aviso(err.message || 'Error al guardar noticia', 'error');
    } finally {
      cargando(false);
    }
  });

  await cargarDatos();
}
