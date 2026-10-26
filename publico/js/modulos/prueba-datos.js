// publico/js/modulos/prueba-datos.js · Formulario y listado de la colección prueba
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: "Prueba de datos" });

const contenido = document.getElementById('contenido');
if (contenido) {
  contenido.innerHTML = `
    <div class="seccion-prueba">
      <header class="pila pila--xs">
        <h1>Prueba de Almacenamiento</h1>
        <p style="color: var(--texto-suave);">
          Envía un registro a la colección <code>prueba</code> para verificar el guardado en disco y el listado de datos.
        </p>
      </header>

      <section class="tarjeta">
        <h2 style="font-size: var(--tamano-l); margin-bottom: var(--espacio-m);">Nuevo Registro</h2>
        <form id="form-prueba" class="pila">
          <div class="campo">
            <label for="input-texto">Texto a almacenar</label>
            <input type="text" id="input-texto" name="texto" placeholder="Escribe un mensaje de prueba..." required autocomplete="off">
            <span class="campo__ayuda">El valor se guardará en datos/prueba.json con ID y fecha ISO automáticos.</span>
          </div>
          <div class="fila">
            <button type="submit" class="btn btn--primario" id="btn-guardar">
              Guardar en Colección
            </button>
          </div>
        </form>
      </section>

      <section class="tarjeta">
        <div class="fila" style="justify-content: space-between; margin-bottom: var(--espacio-m);">
          <h2 style="font-size: var(--tamano-l); margin: 0;">Registros Almacenados</h2>
          <button type="button" class="btn btn--secundario btn--pequeno" id="btn-recargar">
            ↻ Actualizar lista
          </button>
        </div>
        <div id="contenedor-lista">
          <div class="cargando" aria-label="Cargando registros..."></div>
        </div>
      </section>
    </div>
  `;

  const form = document.getElementById('form-prueba');
  const inputTexto = document.getElementById('input-texto');
  const btnGuardar = document.getElementById('btn-guardar');
  const btnRecargar = document.getElementById('btn-recargar');
  const contenedorLista = document.getElementById('contenedor-lista');

  async function cargarRegistros() {
    try {
      const registros = await api.listar('prueba');
      if (!Array.isArray(registros) || registros.length === 0) {
        contenedorLista.innerHTML = `
          <div class="vacio">
            <div class="vacio__icono">📝</div>
            <h3 class="vacio__titulo">No hay registros aún</h3>
            <p class="vacio__texto">Completa el formulario de arriba para agregar el primer registro a la colección.</p>
          </div>
        `;
        return;
      }

      // Ordenar por fecha descendente (más recientes primero)
      const ordenados = [...registros].reverse();

      const itemsHtml = ordenados.map(reg => {
        const textoEscapado = ui.escapar(reg.texto || '');
        const idEscapado = ui.escapar(reg.id || '');
        const fechaTexto = reg.fecha ? util.fechaRelativa(reg.fecha) : '';
        return `
          <li class="item-registro">
            <span class="item-registro__texto">${textoEscapado}</span>
            <div class="item-registro__meta">
              <span class="insignia insignia--info">${idEscapado}</span>
              <small style="color: var(--texto-suave);">${fechaTexto}</small>
            </div>
          </li>
        `;
      }).join('');

      contenedorLista.innerHTML = `<ul class="lista-registros">${itemsHtml}</ul>`;
    } catch (err) {
      ui.aviso(err.message || 'Error al cargar los registros', 'error');
      contenedorLista.innerHTML = `
        <div class="alerta alerta--error" role="alert">
          <strong>Error al consultar la colección:</strong> ${ui.escapar(err.message)}
        </div>
      `;
    }
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = inputTexto.value.trim();
    if (!texto) {
      ui.aviso('El campo de texto no puede estar vacío.', 'advertencia');
      inputTexto.focus();
      return;
    }

    try {
      btnGuardar.disabled = true;
      await api.crear('prueba', { texto });
      ui.aviso('Registro guardado correctamente', 'exito');
      inputTexto.value = '';
      inputTexto.focus();
      await cargarRegistros();
    } catch (err) {
      ui.aviso(err.message || 'No se pudo guardar el registro', 'error');
    } finally {
      btnGuardar.disabled = false;
    }
  });

  btnRecargar?.addEventListener('click', () => {
    cargarRegistros();
  });

  // Carga inicial
  cargarRegistros();
}
