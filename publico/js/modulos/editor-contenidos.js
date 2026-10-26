// publico/js/modulos/editor-contenidos.js · Editor de unidades y temas
import { montarPlantilla } from '../nucleo/plantilla.js';
import { listar, crear, actualizar } from '../nucleo/api.js';
import { aviso, modal, escapar, cargando } from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Contenidos", roles: ["docente", "admin"] });

const contenido = document.getElementById('contenido');

if (contenido) {
  contenido.innerHTML = `
    <div class="tarjeta">
      <div class="editor-cabecera">
        <div>
          <h1 class="tarjeta__titulo">Editor de Contenidos</h1>
          <p class="tarjeta__subtitulo">Estructuración y publicación de unidades didácticas y temas formativos</p>
        </div>
        <div class="editor-selector-asignatura">
          <label for="select-asignatura" style="font-weight: var(--peso-seminegrita); font-size: var(--tamano-s);">Asignatura:</label>
          <select id="select-asignatura" style="margin-top: var(--espacio-xs);">
            <option value="">Cargando asignaturas...</option>
          </select>
        </div>
      </div>

      <div class="editor-columnas">
        <!-- Columna de Unidades -->
        <section class="panel-unidades" aria-label="Unidades de la asignatura">
          <div class="panel-unidades__titulo">
            <span>Unidades</span>
            <button type="button" class="btn btn--secundario btn--pequeno btn-icono" id="btn-agregar-unidad" title="Agregar unidad">
              + Nueva
            </button>
          </div>
          <div class="lista-unidades" id="contenedor-unidades">
            <p style="color: var(--texto-suave); font-size: var(--tamano-xs); text-align: center; margin: var(--espacio-m) 0;">
              Selecciona una asignatura para cargar unidades.
            </p>
          </div>
        </section>

        <!-- Columna de Temas -->
        <section class="panel-temas" aria-label="Temas de la unidad seleccionada">
          <div class="panel-temas__cabecera">
            <div>
              <h2 class="tarjeta__titulo" style="font-size: var(--tamano-m); margin: 0;" id="titulo-unidad-seleccionada">
                Temas de la unidad
              </h2>
              <span style="font-size: var(--tamano-xs); color: var(--texto-suave);" id="subtitulo-unidad-seleccionada">
                Selecciona una unidad de la lista lateral
              </span>
            </div>
            <button type="button" class="btn btn--primario btn--pequeno" id="btn-agregar-tema" disabled>
              + Nuevo Tema
            </button>
          </div>

          <div class="lista-temas" id="contenedor-temas">
            <div class="vacio" style="padding: var(--espacio-xl);">
              <div class="vacio__icono">📂</div>
              <p class="vacio__texto">Selecciona una unidad para ver y organizar sus temas.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;

  let asignaturas = [];
  let unidades = [];
  let temas = [];
  let unidadSeleccionadaId = null;

  const selectAsig = document.getElementById('select-asignatura');
  const contUnidades = document.getElementById('contenedor-unidades');
  const contTemas = document.getElementById('contenedor-temas');
  const btnAgregarUnidad = document.getElementById('btn-agregar-unidad');
  const btnAgregarTema = document.getElementById('btn-agregar-tema');
  const tituloUnidadEl = document.getElementById('titulo-unidad-seleccionada');
  const subtituloUnidadEl = document.getElementById('subtitulo-unidad-seleccionada');

  async function inicializar() {
    cargando(true);
    try {
      const lista = await listar('asignaturas');
      asignaturas = Array.isArray(lista) ? lista : [];

      if (asignaturas.length === 0) {
        selectAsig.innerHTML = `<option value="">No tienes asignaturas disponibles</option>`;
        contUnidades.innerHTML = `<p style="color: var(--texto-suave); font-size: var(--tamano-xs); text-align: center;">No hay asignaturas asignadas.</p>`;
        return;
      }

      selectAsig.innerHTML = `
        <option value="">-- Selecciona una asignatura --</option>
        ${asignaturas.map(a => `<option value="${escapar(a.id)}">${escapar(a.nombre)} (${escapar(a.nivel || '')})</option>`).join('')}
      `;

      // Seleccionar automáticamente la primera si solo hay una
      if (asignaturas.length === 1) {
        selectAsig.value = asignaturas[0].id;
        await cargarUnidadesDeAsignatura(asignaturas[0].id);
      }
    } catch (err) {
      aviso(err.message || 'Error al cargar asignaturas', 'error');
    } finally {
      cargando(false);
    }
  }

  async function cargarUnidadesDeAsignatura(asignaturaId) {
    if (!asignaturaId) {
      unidades = [];
      temas = [];
      unidadSeleccionadaId = null;
      renderizarUnidades();
      renderizarTemas();
      return;
    }

    cargando(true);
    try {
      const todasUnidades = await listar('unidades', { asignaturaId });
      unidades = (Array.isArray(todasUnidades) ? todasUnidades : [])
        .sort((a, b) => (a.orden || 0) - (b.orden || 0));

      // Seleccionar la primera unidad si la actual ya no pertenece o no hay seleccionada
      if (unidades.length > 0) {
        if (!unidades.some(u => u.id === unidadSeleccionadaId)) {
          unidadSeleccionadaId = unidades[0].id;
        }
      } else {
        unidadSeleccionadaId = null;
      }

      renderizarUnidades();
      await cargarTemasDeUnidad(unidadSeleccionadaId);
    } catch (err) {
      aviso(err.message || 'Error al cargar unidades', 'error');
    } finally {
      cargando(false);
    }
  }

  async function cargarTemasDeUnidad(unidadId) {
    if (!unidadId) {
      temas = [];
      btnAgregarTema.disabled = true;
      tituloUnidadEl.textContent = 'Temas de la unidad';
      subtituloUnidadEl.textContent = 'Selecciona una unidad de la lista lateral';
      renderizarTemas();
      return;
    }

    const unidad = unidades.find(u => u.id === unidadId);
    btnAgregarTema.disabled = false;
    tituloUnidadEl.textContent = unidad ? `Temas: ${unidad.titulo}` : 'Temas';
    subtituloUnidadEl.textContent = unidad ? `Orden #${unidad.orden} · ${unidad.visible ? 'Visible para estudiantes' : 'Oculta'}` : '';

    cargando(true);
    try {
      const todosTemas = await listar('temas', { unidadId });
      temas = (Array.isArray(todosTemas) ? todosTemas : [])
        .sort((a, b) => (a.orden || 0) - (b.orden || 0));
      renderizarTemas();
    } catch (err) {
      aviso(err.message || 'Error al cargar temas', 'error');
    } finally {
      cargando(false);
    }
  }

  function renderizarUnidades() {
    if (unidades.length === 0) {
      contUnidades.innerHTML = `
        <p style="color: var(--texto-suave); font-size: var(--tamano-xs); text-align: center; margin: var(--espacio-m) 0;">
          No hay unidades en esta asignatura. Pulsa "+ Nueva" para crear una.
        </p>
      `;
      return;
    }

    contUnidades.innerHTML = unidades.map((u, index) => {
      const esSeleccionada = u.id === unidadSeleccionadaId;
      const esPrimera = index === 0;
      const esUltima = index === unidades.length - 1;

      return `
        <div class="item-unidad ${esSeleccionada ? 'seleccionada' : ''}" data-id="${escapar(u.id)}">
          <div class="item-unidad__info" style="flex: 1;">
            <span class="item-unidad__nombre" title="${escapar(u.titulo)}">
              ${escapar(u.titulo)}
            </span>
            <div style="display: flex; align-items: center; gap: var(--espacio-xs);">
              <span class="insignia insignia--xs ${u.visible ? 'insignia--exito' : 'insignia--advertencia'}">
                ${u.visible ? 'Visible' : 'Oculta'}
              </span>
              <small style="color: var(--texto-suave); font-size: var(--tamano-xs);">#${u.orden || index + 1}</small>
            </div>
          </div>

          <div class="item-unidad__controles" onclick="event.stopPropagation();">
            <button type="button" class="btn btn--texto btn-icono btn-subir-u" data-id="${escapar(u.id)}" ${esPrimera ? 'disabled' : ''} title="Subir orden">
              ↑
            </button>
            <button type="button" class="btn btn--texto btn-icono btn-bajar-u" data-id="${escapar(u.id)}" ${esUltima ? 'disabled' : ''} title="Bajar orden">
              ↓
            </button>
            <button type="button" class="btn btn--texto btn-icono btn-visibilidad-u" data-id="${escapar(u.id)}" title="${u.visible ? 'Ocultar a estudiantes' : 'Mostrar a estudiantes'}">
              ${u.visible ? '👁️' : '🚫'}
            </button>
            <button type="button" class="btn btn--texto btn-icono btn-renombrar-u" data-id="${escapar(u.id)}" title="Renombrar unidad">
              ✏️
            </button>
          </div>
        </div>
      `;
    }).join('');

    vincularEventosUnidades();
  }

  function vincularEventosUnidades() {
    contUnidades.querySelectorAll('.item-unidad').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.dataset.id;
        if (id === unidadSeleccionadaId) return;
        unidadSeleccionadaId = id;
        renderizarUnidades();
        await cargarTemasDeUnidad(unidadSeleccionadaId);
      });
    });

    // Subir orden
    contUnidades.querySelectorAll('.btn-subir-u').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const index = unidades.findIndex(u => u.id === id);
        if (index <= 0) return;
        await intercambiarOrdenUnidades(index, index - 1);
      });
    });

    // Bajar orden
    contUnidades.querySelectorAll('.btn-bajar-u').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const index = unidades.findIndex(u => u.id === id);
        if (index < 0 || index >= unidades.length - 1) return;
        await intercambiarOrdenUnidades(index, index + 1);
      });
    });

    // Alternar visibilidad
    contUnidades.querySelectorAll('.btn-visibilidad-u').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const unidad = unidades.find(u => u.id === id);
        if (!unidad) return;

        try {
          cargando(true);
          const nuevoVisible = !unidad.visible;
          await actualizar('unidades', id, { visible: nuevoVisible });
          unidad.visible = nuevoVisible;
          aviso(`Unidad ahora ${nuevoVisible ? 'visible' : 'oculta'}.`, 'exito');
          renderizarUnidades();
          if (unidad.id === unidadSeleccionadaId) {
            subtituloUnidadEl.textContent = `Orden #${unidad.orden} · ${nuevoVisible ? 'Visible para estudiantes' : 'Oculta'}`;
          }
        } catch (err) {
          aviso(err.message || 'Error al cambiar visibilidad', 'error');
        } finally {
          cargando(false);
        }
      });
    });

    // Renombrar unidad
    contUnidades.querySelectorAll('.btn-renombrar-u').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const unidad = unidades.find(u => u.id === id);
        if (!unidad) return;
        abrirModalUnidad(unidad);
      });
    });
  }

  async function intercambiarOrdenUnidades(idxA, idxB) {
    const unidadA = unidades[idxA];
    const unidadB = unidades[idxB];
    const ordenA = idxA + 1;
    const ordenB = idxB + 1;

    try {
      cargando(true);
      await Promise.all([
        actualizar('unidades', unidadA.id, { orden: ordenB }),
        actualizar('unidades', unidadB.id, { orden: ordenA })
      ]);
      unidadA.orden = ordenB;
      unidadB.orden = ordenA;
      unidades.sort((a, b) => (a.orden || 0) - (b.orden || 0));
      renderizarUnidades();
      aviso('Orden de unidades actualizado.', 'exito');
    } catch (err) {
      aviso(err.message || 'Error al reordenar unidades', 'error');
    } finally {
      cargando(false);
    }
  }

  function renderizarTemas() {
    if (!unidadSeleccionadaId) {
      contTemas.innerHTML = `
        <div class="vacio" style="padding: var(--espacio-xl);">
          <div class="vacio__icono">📂</div>
          <p class="vacio__texto">Selecciona una unidad para ver y organizar sus temas.</p>
        </div>
      `;
      return;
    }

    if (temas.length === 0) {
      contTemas.innerHTML = `
        <div class="vacio" style="padding: var(--espacio-xl);">
          <div class="vacio__icono">📝</div>
          <h3 class="vacio__titulo">No hay temas en esta unidad</h3>
          <p class="vacio__texto">Comienza agregando un nuevo tema con el botón "+ Nuevo Tema".</p>
        </div>
      `;
      return;
    }

    contTemas.innerHTML = temas.map((t, index) => {
      const esPrimero = index === 0;
      const esUltimo = index === temas.length - 1;
      const esPublicado = t.estado === 'publicado';

      return `
        <article class="item-tema" data-id="${escapar(t.id)}">
          <div class="item-tema__cuerpo">
            <span class="item-tema__orden">${t.orden || index + 1}</span>
            <div>
              <div class="item-tema__titulo">${escapar(t.titulo)}</div>
              <span class="insignia insignia--xs ${esPublicado ? 'insignia--exito' : 'insignia--secundario'}" style="margin-top: 2px;">
                ${esPublicado ? 'Publicado' : 'Borrador'}
              </span>
            </div>
          </div>

          <div class="item-tema__acciones">
            <button type="button" class="btn btn--texto btn-icono btn-subir-t" data-id="${escapar(t.id)}" ${esPrimero ? 'disabled' : ''} title="Subir orden">
              ↑
            </button>
            <button type="button" class="btn btn--texto btn-icono btn-bajar-t" data-id="${escapar(t.id)}" ${esUltimo ? 'disabled' : ''} title="Bajar orden">
              ↓
            </button>
            <button type="button" class="btn btn--secundario btn--pequeno btn-estado-t" data-id="${escapar(t.id)}" title="Cambiar estado entre borrador y publicado">
              ${esPublicado ? 'Pasar a Borrador' : 'Publicar'}
            </button>
            <a href="/paginas/editor-tema.html?id=${encodeURIComponent(t.id)}" class="btn btn--primario btn--pequeno">
              Editar ficha →
            </a>
          </div>
        </article>
      `;
    }).join('');

    vincularEventosTemas();
  }

  function vincularEventosTemas() {
    // Subir orden tema
    contTemas.querySelectorAll('.btn-subir-t').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const index = temas.findIndex(t => t.id === id);
        if (index <= 0) return;
        await intercambiarOrdenTemas(index, index - 1);
      });
    });

    // Bajar orden tema
    contTemas.querySelectorAll('.btn-bajar-t').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const index = temas.findIndex(t => t.id === id);
        if (index < 0 || index >= temas.length - 1) return;
        await intercambiarOrdenTemas(index, index + 1);
      });
    });

    // Cambiar estado tema
    contTemas.querySelectorAll('.btn-estado-t').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const tema = temas.find(t => t.id === id);
        if (!tema) return;

        const nuevoEstado = tema.estado === 'publicado' ? 'borrador' : 'publicado';
        try {
          cargando(true);
          await actualizar('temas', id, { estado: nuevoEstado });
          tema.estado = nuevoEstado;
          aviso(`Tema marcado como ${nuevoEstado}.`, 'exito');
          renderizarTemas();
        } catch (err) {
          aviso(err.message || 'Error al cambiar estado del tema', 'error');
        } finally {
          cargando(false);
        }
      });
    });
  }

  async function intercambiarOrdenTemas(idxA, idxB) {
    const temaA = temas[idxA];
    const temaB = temas[idxB];
    const ordenA = idxA + 1;
    const ordenB = idxB + 1;

    try {
      cargando(true);
      await Promise.all([
        actualizar('temas', temaA.id, { orden: ordenB }),
        actualizar('temas', temaB.id, { orden: ordenA })
      ]);
      temaA.orden = ordenB;
      temaB.orden = ordenA;
      temas.sort((a, b) => (a.orden || 0) - (b.orden || 0));
      renderizarTemas();
      aviso('Orden de temas actualizado.', 'exito');
    } catch (err) {
      aviso(err.message || 'Error al reordenar temas', 'error');
    } finally {
      cargando(false);
    }
  }

  function abrirModalUnidad(unidad = null) {
    const asignaturaId = selectAsig.value;
    if (!asignaturaId) {
      aviso('Selecciona primero una asignatura.', 'info');
      return;
    }

    const esEdicion = Boolean(unidad);
    const form = document.createElement('form');
    form.className = 'pila pila--m';
    form.noValidate = true;

    form.innerHTML = `
      <div class="campo">
        <label for="unidad-titulo">Título de la unidad</label>
        <input type="text" id="unidad-titulo" required placeholder="Ej: Valoración Primaria y Soporte Vital" value="${escapar(esEdicion ? unidad.titulo : '')}">
      </div>
      <div class="campo campo--casilla">
        <input type="checkbox" id="unidad-visible" ${esEdicion ? (unidad.visible ? 'checked' : '') : 'checked'}>
        <label for="unidad-visible">Visible para estudiantes</label>
      </div>
    `;

    const inputTitulo = form.querySelector('#unidad-titulo');
    const inputVisible = form.querySelector('#unidad-visible');

    modal({
      titulo: esEdicion ? 'Renombrar Unidad' : 'Nueva Unidad',
      contenido: form,
      acciones: [
        { texto: 'Cancelar', valor: false, clase: 'btn-secundario' },
        { texto: esEdicion ? 'Guardar Cambios' : 'Crear Unidad', valor: true, clase: 'btn-primario' }
      ]
    }).then(async (guardar) => {
      if (!guardar) return;

      const titulo = inputTitulo.value.trim();
      const visible = inputVisible.checked;
      if (!titulo) {
        aviso('El título de la unidad es obligatorio.', 'error');
        return;
      }

      try {
        cargando(true);
        if (esEdicion) {
          await actualizar('unidades', unidad.id, { titulo, visible });
          unidad.titulo = titulo;
          unidad.visible = visible;
          aviso('Unidad actualizada con éxito.', 'exito');
          renderizarUnidades();
          if (unidad.id === unidadSeleccionadaId) {
            tituloUnidadEl.textContent = `Temas: ${titulo}`;
            subtituloUnidadEl.textContent = `Orden #${unidad.orden} · ${visible ? 'Visible para estudiantes' : 'Oculta'}`;
          }
        } else {
          const orden = unidades.length + 1;
          const nueva = await crear('unidades', {
            asignaturaId,
            titulo,
            orden,
            visible
          });
          aviso('Unidad creada con éxito.', 'exito');
          unidadSeleccionadaId = nueva.id;
          await cargarUnidadesDeAsignatura(asignaturaId);
        }
      } catch (err) {
        aviso(err.message || 'Error al guardar unidad', 'error');
      } finally {
        cargando(false);
      }
    });
  }

  function abrirModalTema() {
    if (!unidadSeleccionadaId) {
      aviso('Selecciona una unidad antes de agregar un tema.', 'info');
      return;
    }

    const form = document.createElement('form');
    form.className = 'pila pila--m';
    form.noValidate = true;

    form.innerHTML = `
      <div class="campo">
        <label for="tema-titulo">Título del tema</label>
        <input type="text" id="tema-titulo" required placeholder="Ej: Protocolo ABCDE en Emergencias">
        <small class="campo__ayuda">El tema se creará en estado <strong>borrador</strong>. Podrás editar todos los detalles con el botón "Editar ficha".</small>
      </div>
    `;

    const inputTitulo = form.querySelector('#tema-titulo');

    modal({
      titulo: 'Nuevo Tema',
      contenido: form,
      acciones: [
        { texto: 'Cancelar', valor: false, clase: 'btn-secundario' },
        { texto: 'Crear Tema', valor: true, clase: 'btn-primario' }
      ]
    }).then(async (guardar) => {
      if (!guardar) return;

      const titulo = inputTitulo.value.trim();
      if (!titulo) {
        aviso('El título del tema es obligatorio.', 'error');
        return;
      }

      try {
        cargando(true);
        const orden = temas.length + 1;
        await crear('temas', {
          unidadId: unidadSeleccionadaId,
          titulo,
          orden,
          objetivos: [],
          resumen: '',
          ejemplos: [],
          erroresFrecuentes: [],
          preguntasGuia: [],
          recursos: [],
          palabrasClave: [],
          dificultad: 'intermedio',
          fuentes: '',
          estado: 'borrador'
        });

        aviso('Tema creado como borrador.', 'exito');
        await cargarTemasDeUnidad(unidadSeleccionadaId);
      } catch (err) {
        aviso(err.message || 'Error al crear tema', 'error');
      } finally {
        cargando(false);
      }
    });
  }

  selectAsig.addEventListener('change', async (e) => {
    await cargarUnidadesDeAsignatura(e.target.value);
  });

  btnAgregarUnidad.addEventListener('click', () => abrirModalUnidad());
  btnAgregarTema.addEventListener('click', () => abrirModalTema());

  await inicializar();
}
