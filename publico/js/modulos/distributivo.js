// publico/js/modulos/distributivo.js · Gestión de grupos y distributivo académico (admin)
import { montarPlantilla } from '../nucleo/plantilla.js';
import { listar, crear, actualizar, eliminar } from '../nucleo/api.js';
import { aviso, confirmar, modal, escapar, cargando } from '../nucleo/ui.js';
import { docentesIdsDeGrupo } from '../nucleo/distributivo.js';

await montarPlantilla({ titulo: "Distributivo", roles: ["admin"] });

const contenido = document.getElementById('contenido');

if (contenido) {
  contenido.innerHTML = `
    <div class="tarjeta">
      <div class="distributivo-cabecera">
        <div>
          <h1 class="tarjeta__titulo">Distributivo Académico</h1>
          <p class="tarjeta__subtitulo">Gestión de paralelos, docentes asignados y nómina de estudiantes</p>
        </div>
        <button type="button" class="btn btn--primario" id="btn-nuevo-grupo">
          + Nuevo Grupo
        </button>
      </div>

      <div class="tabla-usuarios-contenedor">
        <table class="tabla" id="tabla-distributivo" aria-label="Grupos del distributivo">
          <thead>
            <tr>
              <th>Asignatura</th>
              <th>Paralelo</th>
              <th>Período</th>
              <th>Docentes</th>
              <th>Estudiantes</th>
              <th style="text-align: right;">Acciones</th>
            </tr>
          </thead>
          <tbody id="cuerpo-tabla-distributivo">
            <tr>
              <td colspan="6" style="text-align: center; padding: var(--espacio-l);">Cargando distributivo...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  let grupos = [];
  let asignaturas = [];
  let usuarios = [];
  const cuerpoTabla = document.getElementById('cuerpo-tabla-distributivo');
  const btnNuevo = document.getElementById('btn-nuevo-grupo');

  async function cargarDatos() {
    cargando(true);
    try {
      const [listaGrupos, listaAsig, listaUsu] = await Promise.all([
        listar('distributivo'),
        listar('asignaturas'),
        listar('usuarios')
      ]);

      grupos = Array.isArray(listaGrupos) ? listaGrupos : [];
      asignaturas = Array.isArray(listaAsig) ? listaAsig : [];
      usuarios = Array.isArray(listaUsu) ? listaUsu : [];

      renderizarTabla();
    } catch (err) {
      aviso(err.message || 'Error al cargar datos del distributivo', 'error');
      cuerpoTabla.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--error); padding: var(--espacio-l);">
            No se pudieron cargar los datos del distributivo.
          </td>
        </tr>
      `;
    } finally {
      cargando(false);
    }
  }

  function renderizarTabla() {
    if (grupos.length === 0) {
      cuerpoTabla.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: var(--espacio-l); color: var(--texto-suave);">
            No hay grupos creados en el distributivo.
          </td>
        </tr>
      `;
      return;
    }

    const mapaAsignaturas = new Map(asignaturas.map(a => [a.id, a.nombre]));
    const mapaUsuarios = new Map(usuarios.map(u => [u.id, `${u.nombre} ${u.apellido}`]));

    cuerpoTabla.innerHTML = grupos.map(g => {
      const nombreAsignatura = mapaAsignaturas.get(g.asignaturaId) || g.asignaturaId || 'Sin asignar';
      const nombresDocentes = docentesIdsDeGrupo(g)
        .map(id => mapaUsuarios.get(id))
        .filter(Boolean);
      const cantEstudiantes = Array.isArray(g.estudiantes) ? g.estudiantes.length : 0;

      return `
        <tr data-id="${escapar(g.id)}">
          <td><strong>${escapar(nombreAsignatura)}</strong></td>
          <td><span class="insignia insignia--secundario">${escapar(g.paralelo || 'N/A')}</span></td>
          <td>${escapar(g.periodo || 'N/A')}</td>
          <td>${nombresDocentes.length
            ? nombresDocentes.map(nombre => `<span class="insignia insignia--secundario">${escapar(nombre)}</span>`).join(' ')
            : 'Docente no asignado'}</td>
          <td><span class="insignia insignia--info">${cantEstudiantes} estudiantes</span></td>
          <td style="text-align: right;">
            <div class="fila fila--xs" style="justify-content: flex-end;">
              <button type="button" class="btn btn--secundario btn--pequeno btn-editar-grupo" data-id="${escapar(g.id)}">
                Editar
              </button>
              <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar-grupo" data-id="${escapar(g.id)}" data-nombre="${escapar(nombreAsignatura)} - ${escapar(g.paralelo)}">
                Eliminar
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    vincularEventosTabla();
  }

  function vincularEventosTabla() {
    cuerpoTabla.querySelectorAll('.btn-editar-grupo').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const grupo = grupos.find(g => g.id === id);
        if (grupo) abrirModalGrupo(grupo);
      });
    });

    cuerpoTabla.querySelectorAll('.btn-eliminar-grupo').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const nombre = btn.dataset.nombre;

        const confirmado = await confirmar(`¿Seguro que deseas eliminar el grupo ${nombre}?`);
        if (!confirmado) return;

        try {
          cargando(true);
          await eliminar('distributivo', id);
          aviso('Grupo eliminado con éxito.', 'exito');
          await cargarDatos();
        } catch (err) {
          aviso(err.message || 'Error al eliminar grupo', 'error');
        } finally {
          cargando(false);
        }
      });
    });
  }

  function abrirModalGrupo(grupo = null) {
    const esEdicion = Boolean(grupo);
    const docentes = usuarios.filter(u => u.rol === 'docente' && u.activo !== false);
    const todosEstudiantes = usuarios.filter(u => u.rol === 'estudiante' && u.activo !== false);

    const seleccionados = new Set(esEdicion && Array.isArray(grupo.estudiantes) ? grupo.estudiantes : []);
    const docentesSeleccionados = new Set(esEdicion ? docentesIdsDeGrupo(grupo) : []);

    const form = document.createElement('form');
    form.className = 'pila pila--m';
    form.noValidate = true;

    form.innerHTML = `
      <div class="campo">
        <label for="grupo-asig">Asignatura</label>
        <select id="grupo-asig" required>
          <option value="">Selecciona una asignatura</option>
          ${asignaturas.map(a => `
            <option value="${escapar(a.id)}" ${esEdicion && grupo.asignaturaId === a.id ? 'selected' : ''}>
              ${escapar(a.nombre)} (${escapar(a.nivel || '')})
            </option>
          `).join('')}
        </select>
      </div>

      <div class="fila fila--m" style="gap: var(--espacio-m);">
        <div class="campo" style="flex: 1;">
          <label for="grupo-paralelo">Paralelo</label>
          <input type="text" id="grupo-paralelo" required placeholder="Ej: A, B, C..." value="${escapar(esEdicion ? (grupo.paralelo || '') : '')}">
        </div>
        <div class="campo" style="flex: 1;">
          <label for="grupo-periodo">Período</label>
          <input type="text" id="grupo-periodo" required placeholder="Ej: 2026-2027" value="${escapar(esEdicion ? (grupo.periodo || '') : '2026-2027')}">
        </div>
      </div>

      <fieldset class="campo distributivo-docentes">
        <legend>Docentes asignados</legend>
        <small class="campo__ayuda">Selecciona uno o varios docentes. Todos podrán administrar contenidos y crear con IA.</small>
        <div class="distributivo-seleccion-lista">
          ${docentes.map(d => `
            <label class="distributivo-estudiante-item">
              <input type="checkbox" class="chk-docente" value="${escapar(d.id)}" ${docentesSeleccionados.has(String(d.id)) ? 'checked' : ''}>
              <span>${escapar(d.nombre)} ${escapar(d.apellido)} <small>(${escapar(d.correo)})</small></span>
            </label>
          `).join('') || '<p class="campo__ayuda">No hay docentes activos disponibles.</p>'}
        </div>
      </fieldset>
      </div>

      <div class="campo">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--espacio-xs);">
          <label for="buscar-estudiante-modal" style="margin: 0;">Estudiantes matriculados</label>
          <span class="distributivo-contador" id="contador-seleccionados">
            ${seleccionados.size} seleccionados
          </span>
        </div>
        <input type="search" id="buscar-estudiante-modal" placeholder="Filtrar estudiante por nombre o correo...">
        
        <div class="distributivo-estudiantes-lista" id="lista-estudiantes-contenedor" style="margin-top: var(--espacio-xs);">
        </div>
      </div>
    `;

    const selectAsig = form.querySelector('#grupo-asig');
    const inputParalelo = form.querySelector('#grupo-paralelo');
    const inputPeriodo = form.querySelector('#grupo-periodo');
    const inputBuscarEst = form.querySelector('#buscar-estudiante-modal');
    const contEstudiantes = form.querySelector('#lista-estudiantes-contenedor');
    const contadorSpan = form.querySelector('#contador-seleccionados');

    function renderizarListaEstudiantes() {
      const q = inputBuscarEst.value.trim().toLowerCase();
      const filtrados = todosEstudiantes.filter(est => {
        if (!q) return true;
        const nombreCompleto = `${est.nombre || ''} ${est.apellido || ''}`.toLowerCase();
        const correo = (est.correo || '').toLowerCase();
        return nombreCompleto.includes(q) || correo.includes(q);
      });

      if (filtrados.length === 0) {
        contEstudiantes.innerHTML = `<p style="color: var(--texto-suave); font-size: var(--tamano-xs); text-align: center; margin: var(--espacio-s) 0;">No se encontraron estudiantes.</p>`;
        return;
      }

      contEstudiantes.innerHTML = filtrados.map(est => {
        const checked = seleccionados.has(est.id);
        return `
          <label class="distributivo-estudiante-item">
            <input type="checkbox" class="chk-estudiante" value="${escapar(est.id)}" ${checked ? 'checked' : ''}>
            <span style="font-size: var(--tamano-s);">${escapar(est.nombre)} ${escapar(est.apellido)} <small style="color: var(--texto-suave);">(${escapar(est.correo)})</small></span>
          </label>
        `;
      }).join('');

      contEstudiantes.querySelectorAll('.chk-estudiante').forEach(chk => {
        chk.addEventListener('change', (e) => {
          if (e.target.checked) {
            seleccionados.add(e.target.value);
          } else {
            seleccionados.delete(e.target.value);
          }
          contadorSpan.textContent = `${seleccionados.size} seleccionados`;
        });
      });
    }

    inputBuscarEst.addEventListener('input', renderizarListaEstudiantes);
    renderizarListaEstudiantes();

    modal({
      titulo: esEdicion ? 'Editar Grupo del Distributivo' : 'Nuevo Grupo',
      contenido: form,
      acciones: [
        { texto: 'Cancelar', valor: false, clase: 'btn-secundario' },
        { texto: esEdicion ? 'Guardar Cambios' : 'Crear Grupo', valor: true, clase: 'btn-primario' }
      ]
    }).then(async (guardar) => {
      if (!guardar) return;

      const asignaturaId = selectAsig.value;
      const paralelo = inputParalelo.value.trim();
      const periodo = inputPeriodo.value.trim();
      const docentesIds = Array.from(form.querySelectorAll('.chk-docente:checked')).map(item => item.value);
      const estudiantes = Array.from(seleccionados);

      if (!asignaturaId || !paralelo || !periodo || !docentesIds.length) {
        aviso('Completa los campos y selecciona al menos un docente.', 'error');
        return;
      }

      const datosGrupo = {
        asignaturaId,
        paralelo,
        periodo,
        docenteId: docentesIds[0],
        docentesIds,
        estudiantes
      };

      try {
        cargando(true);
        if (esEdicion) {
          await actualizar('distributivo', grupo.id, datosGrupo);
          aviso('Grupo actualizado con éxito.', 'exito');
        } else {
          await crear('distributivo', datosGrupo);
          aviso('Grupo creado con éxito.', 'exito');
        }
        await cargarDatos();
      } catch (err) {
        aviso(err.message || 'Error al guardar grupo', 'error');
      } finally {
        cargando(false);
      }
    });
  }

  btnNuevo.addEventListener('click', () => abrirModalGrupo());

  await cargarDatos();
}
