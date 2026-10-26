// publico/js/modulos/admin-asignaturas.js · Gestión de asignaturas (admin)
import { montarPlantilla } from '../nucleo/plantilla.js';
import { listar, crear, actualizar, eliminar } from '../nucleo/api.js';
import { aviso, confirmar, modal, escapar, cargando } from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Asignaturas", roles: ["admin"] });

const contenido = document.getElementById('contenido');

if (contenido) {
  contenido.innerHTML = `
    <div class="tarjeta">
      <div class="asignaturas-cabecera">
        <div>
          <h1 class="tarjeta__titulo">Gestión de Asignaturas</h1>
          <p class="tarjeta__subtitulo">Catálogo académico, descripción y niveles de formación</p>
        </div>
        <button type="button" class="btn btn--primario" id="btn-nueva-asignatura">
          + Nueva Asignatura
        </button>
      </div>

      <div class="asignaturas-grid" id="contenedor-asignaturas">
        <p style="color: var(--texto-suave);">Cargando asignaturas...</p>
      </div>
    </div>
  `;

  let asignaturas = [];
  let grupos = [];
  const contenedor = document.getElementById('contenedor-asignaturas');
  const btnNueva = document.getElementById('btn-nueva-asignatura');

  async function cargarDatos() {
    cargando(true);
    try {
      const [listaAsig, listaGrupos] = await Promise.all([
        listar('asignaturas'),
        listar('distributivo')
      ]);
      asignaturas = Array.isArray(listaAsig) ? listaAsig : [];
      grupos = Array.isArray(listaGrupos) ? listaGrupos : [];
      renderizar();
    } catch (err) {
      aviso(err.message || 'Error al cargar asignaturas', 'error');
      contenedor.innerHTML = `<p style="color: var(--error);">Error al cargar los datos.</p>`;
    } finally {
      cargando(false);
    }
  }

  function renderizar() {
    if (asignaturas.length === 0) {
      contenedor.innerHTML = `
        <div class="vacio" style="grid-column: 1 / -1; padding: var(--espacio-xl);">
          <div class="vacio__icono">📚</div>
          <h3 class="vacio__titulo">No hay asignaturas registradas</h3>
          <p class="vacio__texto">Comienza creando una nueva asignatura para organizar los grupos y temas.</p>
        </div>
      `;
      return;
    }

    contenedor.innerHTML = asignaturas.map(asig => {
      const gruposDeEsta = grupos.filter(g => g.asignaturaId === asig.id);
      const totalGrupos = gruposDeEsta.length;

      return `
        <article class="tarjeta tarjeta-asignatura" data-id="${escapar(asig.id)}">
          <div class="tarjeta-asignatura__cuerpo">
            <div class="tarjeta-asignatura__nivel">
              <span class="insignia insignia--info">${escapar(asig.nivel || 'Nivel no especificado')}</span>
            </div>
            <h2 class="tarjeta__titulo" style="font-size: var(--tamano-m); margin: var(--espacio-xs) 0;">${escapar(asig.nombre)}</h2>
            <p class="tarjeta-asignatura__descripcion">${escapar(asig.descripcion || 'Sin descripción.')}</p>
            <div class="tarjeta-asignatura__meta">
              <strong>Grupos asignados:</strong> ${totalGrupos}
            </div>
          </div>
          <div class="tarjeta-asignatura__acciones">
            <button type="button" class="btn btn--secundario btn--pequeno btn-editar" data-id="${escapar(asig.id)}">
              Editar
            </button>
            <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar" data-id="${escapar(asig.id)}" data-nombre="${escapar(asig.nombre)}" data-grupos="${totalGrupos}">
              Eliminar
            </button>
          </div>
        </article>
      `;
    }).join('');

    vincularEventos();
  }

  function vincularEventos() {
    contenedor.querySelectorAll('.btn-editar').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const asig = asignaturas.find(a => a.id === id);
        if (asig) abrirModalFormulario(asig);
      });
    });

    contenedor.querySelectorAll('.btn-eliminar').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const nombre = btn.dataset.nombre;
        const totalGrupos = parseInt(btn.dataset.grupos, 10) || 0;

        if (totalGrupos > 0) {
          aviso(`No se puede eliminar la asignatura "${nombre}" porque tiene ${totalGrupos} grupo(s) en el distributivo.`, 'error');
          return;
        }

        const confirmado = await confirmar(`¿Estás seguro de eliminar la asignatura "${nombre}"?`);
        if (!confirmado) return;

        try {
          cargando(true);
          await eliminar('asignaturas', id);
          aviso('Asignatura eliminada con éxito.', 'exito');
          await cargarDatos();
        } catch (err) {
          aviso(err.message || 'Error al eliminar asignatura', 'error');
        } finally {
          cargando(false);
        }
      });
    });
  }

  function abrirModalFormulario(asignatura = null) {
    const esEdicion = Boolean(asignatura);

    const form = document.createElement('form');
    form.className = 'pila pila--m';
    form.noValidate = true;

    form.innerHTML = `
      <div class="campo">
        <label for="asig-nombre">Nombre de la asignatura</label>
        <input type="text" id="asig-nombre" required placeholder="Ej: Generalidades de Abordaje Inicial..." value="${escapar(esEdicion ? asignatura.nombre : '')}">
        <span class="campo__error" id="error-asig-nombre"></span>
      </div>

      <div class="campo">
        <label for="asig-nivel">Nivel académico</label>
        <input type="text" id="asig-nivel" required placeholder="Ej: Primer Nivel, Segundo Semestre..." value="${escapar(esEdicion ? asignatura.nivel : '')}">
        <span class="campo__error" id="error-asig-nivel"></span>
      </div>

      <div class="campo">
        <label for="asig-desc">Descripción</label>
        <textarea id="asig-desc" rows="3" placeholder="Resumen general de los contenidos formativos...">${escapar(esEdicion ? (asignatura.descripcion || '') : '')}</textarea>
        <span class="campo__error" id="error-asig-desc"></span>
      </div>
    `;

    const inputNombre = form.querySelector('#asig-nombre');
    const inputNivel = form.querySelector('#asig-nivel');
    const inputDesc = form.querySelector('#asig-desc');
    const errorNombre = form.querySelector('#error-asig-nombre');
    const errorNivel = form.querySelector('#error-asig-nivel');

    modal({
      titulo: esEdicion ? 'Editar Asignatura' : 'Nueva Asignatura',
      contenido: form,
      acciones: [
        { texto: 'Cancelar', valor: false, clase: 'btn-secundario' },
        { texto: esEdicion ? 'Guardar Cambios' : 'Crear Asignatura', valor: true, clase: 'btn-primario' }
      ]
    }).then(async (guardar) => {
      if (!guardar) return;

      const nombre = inputNombre.value.trim();
      const nivel = inputNivel.value.trim();
      const descripcion = inputDesc.value.trim();

      if (!nombre || !nivel) {
        aviso('El nombre y el nivel son obligatorios.', 'error');
        return;
      }

      try {
        cargando(true);
        if (esEdicion) {
          await actualizar('asignaturas', asignatura.id, { nombre, nivel, descripcion });
          aviso('Asignatura actualizada con éxito.', 'exito');
        } else {
          await crear('asignaturas', { nombre, nivel, descripcion });
          aviso('Asignatura creada con éxito.', 'exito');
        }
        await cargarDatos();
      } catch (err) {
        aviso(err.message || 'Error al guardar asignatura', 'error');
      } finally {
        cargando(false);
      }
    });
  }

  btnNueva.addEventListener('click', () => abrirModalFormulario());

  await cargarDatos();
}
