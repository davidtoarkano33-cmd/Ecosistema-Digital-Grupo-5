// publico/js/modulos/admin-usuarios.js · Gestión de usuarios, roles, estado y reseteo de claves
import { montarPlantilla } from '../nucleo/plantilla.js';
import { listar, actualizar, llamar } from '../nucleo/api.js';
import { aviso, confirmar, modal, escapar, cargando } from '../nucleo/ui.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: "Administración de Usuarios", roles: ["admin"] });

const contenido = document.getElementById('contenido');
const yo = usuarioActual();

if (contenido) {
  contenido.innerHTML = `
    <div class="tarjeta">
      <div class="fila" style="justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--espacio-m);">
        <div>
          <h1 class="tarjeta__titulo">Administración de Usuarios</h1>
          <p class="tarjeta__subtitulo">Gestión de cuentas, asignación de roles y restablecimiento de acceso</p>
        </div>
        <div>
          <button type="button" class="btn btn--secundario" id="btn-probar-ia" title="Verificar conectividad con el servicio de IA">
            🤖 Probar Servicio de IA
          </button>
        </div>
      </div>

      <div class="admin-filtros">
        <div class="campo">
          <label for="buscar-usuario">Buscar usuario</label>
          <input type="search" id="buscar-usuario" placeholder="Nombre, apellido o correo...">
        </div>

        <div class="campo" style="max-width: 220px;">
          <label for="filtro-rol">Filtrar por rol</label>
          <select id="filtro-rol">
            <option value="">Todos los roles</option>
            <option value="estudiante">Estudiante</option>
            <option value="docente">Docente</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
      </div>

      <div class="tabla-usuarios-contenedor">
        <table class="tabla" id="tabla-usuarios" aria-label="Listado de usuarios">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Correo electrónico</th>
              <th>Rol</th>
              <th>Activo</th>
              <th style="text-align: right;">Acciones</th>
            </tr>
          </thead>
          <tbody id="cuerpo-tabla-usuarios">
            <tr>
              <td colspan="5" style="text-align: center; padding: var(--espacio-l);">Cargando usuarios...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  let usuarios = [];
  const cuerpoTabla = document.getElementById('cuerpo-tabla-usuarios');
  const inputBuscar = document.getElementById('buscar-usuario');
  const selectRol = document.getElementById('filtro-rol');

  async function cargarUsuarios() {
    cargando(true);
    try {
      usuarios = await listar('usuarios');
      renderizarTabla();
    } catch (err) {
      aviso(err.message || 'Error al cargar usuarios', 'error');
      cuerpoTabla.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--error); padding: var(--espacio-l);">
            No se pudieron cargar los usuarios.
          </td>
        </tr>
      `;
    } finally {
      cargando(false);
    }
  }

  function renderizarTabla() {
    const busqueda = inputBuscar.value.trim().toLowerCase();
    const rolSeleccionado = selectRol.value;

    const filtrados = usuarios.filter(u => {
      if (rolSeleccionado && u.rol !== rolSeleccionado) {
        return false;
      }
      if (busqueda) {
        const nombreCompleto = `${u.nombre || ''} ${u.apellido || ''}`.toLowerCase();
        const correo = (u.correo || '').toLowerCase();
        return nombreCompleto.includes(busqueda) || correo.includes(busqueda);
      }
      return true;
    });

    if (filtrados.length === 0) {
      cuerpoTabla.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: var(--espacio-l); color: var(--texto-suave);">
            No se encontraron usuarios que coincidan con los criterios.
          </td>
        </tr>
      `;
      return;
    }

    cuerpoTabla.innerHTML = filtrados.map(u => {
      const esYo = yo && String(yo.id) === String(u.id);
      const iniciales = `${(u.nombre || '').charAt(0)}${(u.apellido || '').charAt(0)}`.toUpperCase() || 'U';
      const avatarHtml = u.foto
        ? `<img src="${escapar(u.foto)}" alt="" class="avatar-miniatura">`
        : `<div class="avatar-miniatura avatar-miniatura--vacio">${escapar(iniciales)}</div>`;

      return `
        <tr data-id="${escapar(u.id)}">
          <td>
            <div class="celda-usuario">
              ${avatarHtml}
              <div>
                <strong>${escapar(u.nombre)} ${escapar(u.apellido)}</strong>
                ${esYo ? '<span class="insignia insignia--info" style="margin-left: var(--espacio-xs);">Tú</span>' : ''}
              </div>
            </div>
          </td>
          <td>${escapar(u.correo)}</td>
          <td>
            <select class="selector-rol-usuario" data-id="${escapar(u.id)}" ${esYo ? 'disabled title="No puedes cambiar tu propio rol"' : ''}>
              <option value="estudiante" ${u.rol === 'estudiante' ? 'selected' : ''}>Estudiante</option>
              <option value="docente" ${u.rol === 'docente' ? 'selected' : ''}>Docente</option>
              <option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>Administrador</option>
            </select>
          </td>
          <td>
            <label style="display: inline-flex; align-items: center; gap: var(--espacio-xs); cursor: ${esYo ? 'not-allowed' : 'pointer'};">
              <input type="checkbox" class="casilla-activo-usuario" data-id="${escapar(u.id)}" ${u.activo !== false ? 'checked' : ''} ${esYo ? 'disabled title="No puedes desactivarte a ti mismo"' : ''}>
              <span>${u.activo !== false ? 'Activo' : 'Inactivo'}</span>
            </label>
          </td>
          <td style="text-align: right;">
            <div class="acciones-usuario">
              <button type="button" class="btn btn--secundario btn--pequeno btn-restablecer-clave" data-id="${escapar(u.id)}" data-nombre="${escapar(u.nombre)} ${escapar(u.apellido)}">
                Restablecer clave
              </button>
              ${esYo ? '' : `
                <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar-usuario" data-id="${escapar(u.id)}" data-nombre="${escapar(u.nombre)} ${escapar(u.apellido)}">
                  Eliminar usuario y datos
                </button>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    vincularEventosTabla();
  }

  function vincularEventosTabla() {
    // Selectores de rol
    cuerpoTabla.querySelectorAll('.selector-rol-usuario').forEach(select => {
      select.addEventListener('change', async (e) => {
        const id = e.target.dataset.id;
        const nuevoRol = e.target.value;
        const u = usuarios.find(item => String(item.id) === String(id));
        const rolAnterior = u ? u.rol : nuevoRol;

        try {
          await actualizar('usuarios', id, { rol: nuevoRol });
          if (u) u.rol = nuevoRol;
          aviso(`Rol de ${u ? u.nombre : 'usuario'} actualizado a ${nuevoRol}.`, 'exito');
        } catch (err) {
          e.target.value = rolAnterior;
          aviso(err.message || 'Error al actualizar el rol', 'error');
        }
      });
    });

    // Casillas de activo/inactivo
    cuerpoTabla.querySelectorAll('.casilla-activo-usuario').forEach(chk => {
      chk.addEventListener('change', async (e) => {
        const id = e.target.dataset.id;
        const nuevoActivo = e.target.checked;
        const spanTexto = e.target.nextElementSibling;
        const u = usuarios.find(item => String(item.id) === String(id));

        try {
          await actualizar('usuarios', id, { activo: nuevoActivo });
          if (u) u.activo = nuevoActivo;
          if (spanTexto) spanTexto.textContent = nuevoActivo ? 'Activo' : 'Inactivo';
          aviso(`Usuario ${nuevoActivo ? 'activado' : 'desactivado'} con éxito.`, 'exito');
        } catch (err) {
          e.target.checked = !nuevoActivo;
          if (spanTexto) spanTexto.textContent = !nuevoActivo ? 'Activo' : 'Inactivo';
          aviso(err.message || 'Error al actualizar estado del usuario', 'error');
        }
      });
    });

    // Restablecer clave
    cuerpoTabla.querySelectorAll('.btn-restablecer-clave').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const nombre = btn.dataset.nombre;

        const confirmado = await confirmar(`¿Seguro que deseas restablecer la contraseña de ${nombre}? Se generará una clave temporal.`);
        if (!confirmado) return;

        try {
          const res = await llamar('POST', `/api/admin/usuarios/${encodeURIComponent(id)}/restablecer`);
          const claveTemp = res.claveTemporal;

          const contenidoModal = document.createElement('div');
          contenidoModal.className = 'pila pila--m';
          contenidoModal.innerHTML = `
            <p>Se ha generado una nueva contraseña temporal para <strong>${escapar(nombre)}</strong>. Compártela de forma segura:</p>
            <div class="modal-clave-temporal">
              <span class="modal-clave-codigo" id="codigo-clave-temp">${escapar(claveTemp)}</span>
              <button type="button" class="btn btn--secundario btn--pequeno" id="btn-copiar-clave">
                Copiar
              </button>
            </div>
            <small class="campo__ayuda">El usuario podrá iniciar sesión con esta clave y luego cambiarla desde su perfil.</small>
          `;

          const btnCopiar = contenidoModal.querySelector('#btn-copiar-clave');
          btnCopiar.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(claveTemp);
              btnCopiar.textContent = '¡Copiado!';
              setTimeout(() => { btnCopiar.textContent = 'Copiar'; }, 2000);
            } catch {
              aviso('No se pudo copiar automáticamente. Por favor selecciónala manualmente.', 'info');
            }
          });

          await modal({
            titulo: 'Contraseña Temporal Generada',
            contenido: contenidoModal,
            acciones: [{ texto: 'Cerrar', valor: true, clase: 'btn-primario' }]
          });
        } catch (err) {
          aviso(err.message || 'Error al restablecer contraseña', 'error');
        }
      });
    });

    // Eliminar definitivamente la cuenta y sus datos vinculados
    cuerpoTabla.querySelectorAll('.btn-eliminar-usuario').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const nombre = btn.dataset.nombre;
        const confirmado = await confirmar(
          `¿Eliminar definitivamente a ${nombre} y todos sus datos? Esta acción no se puede deshacer.`
        );
        if (!confirmado) return;

        btn.disabled = true;
        try {
          const respuesta = await llamar('DELETE', `/api/admin/usuarios/${encodeURIComponent(id)}/datos`);
          usuarios = usuarios.filter(item => String(item.id) !== String(id));
          renderizarTabla();
          aviso(`Usuario y datos eliminados (${respuesta.eliminados || 1} registros).`, 'exito');
        } catch (err) {
          btn.disabled = false;
          aviso(err.message || 'No se pudo eliminar el usuario', 'error');
        }
      });
    });
  }

  inputBuscar.addEventListener('input', renderizarTabla);
  selectRol.addEventListener('change', renderizarTabla);

  const btnProbarIa = document.getElementById('btn-probar-ia');
  if (btnProbarIa) {
    btnProbarIa.addEventListener('click', async () => {
      cargando(true);
      try {
        const respuesta = await llamar('GET', '/api/ia/prueba');
        modal({
          titulo: 'Conexión con IA Exitosa',
          contenido: `<div class="pila pila--s"><p>El servicio de IA respondió correctamente:</p><p><strong style="color: var(--exito); font-size: var(--tamano-l);">${escapar(respuesta.resultado || 'OK')}</strong></p><small class="campo__ayuda">La API key y el modelo configurados en el servidor están activos y funcionales.</small></div>`,
          acciones: [{ texto: 'Aceptar', valor: true, clase: 'btn-primario' }]
        });
      } catch (err) {
        modal({
          titulo: 'Fallo al conectar con IA',
          contenido: `<div class="pila pila--s"><p style="color: var(--error);">Error devuelto por el servicio:</p><p><strong>${escapar(err.message)}</strong></p><small class="campo__ayuda">Revisa IA_PROVEEDOR, IA_MODELO e IA_CLAVE en el archivo .env del servidor.</small></div>`,
          acciones: [{ texto: 'Entendido', valor: true, clase: 'btn-secundario' }]
        });
      } finally {
        cargando(false);
      }
    });
  }

  await cargarUsuarios();
}
