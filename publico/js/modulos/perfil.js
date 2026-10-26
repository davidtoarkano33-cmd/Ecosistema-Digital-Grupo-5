// publico/js/modulos/perfil.js · Edición de perfil, cambio de clave y subida de avatar
import { montarPlantilla } from '../nucleo/plantilla.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { llamar, subir, listar } from '../nucleo/api.js';
import { aviso, escapar, cargando } from '../nucleo/ui.js';
import { fechaCorta } from '../nucleo/util.js';
import { logrosDe } from '../nucleo/gamificacion.js';
import { generarDiploma } from '../nucleo/pdf.js';

await montarPlantilla({ titulo: "Mi Perfil", roles: ["sesion"] });

const usuario = usuarioActual();
const contenido = document.getElementById('contenido');

if (contenido && usuario) {
  // Cargar datos completos del perfil
  let datosPerfil = { ...usuario };
  try {
    const perfilServidor = await llamar('GET', '/api/auth/yo');
    if (perfilServidor) {
      datosPerfil = perfilServidor;
      sessionStorage.setItem('usuario', JSON.stringify({
        ...usuario,
        nombre: perfilServidor.nombre,
        apellido: perfilServidor.apellido,
        rol: perfilServidor.rol,
        foto: perfilServidor.foto || null
      }));
    }
  } catch {
    // Si falla la petición de datos extra, usar los de la sesión actual
  }

  const iniciales = `${(datosPerfil.nombre || '').charAt(0)}${(datosPerfil.apellido || '').charAt(0)}`.toUpperCase() || 'U';

  const avatarHtml = datosPerfil.foto
    ? `<img src="${escapar(datosPerfil.foto)}" alt="Foto de perfil" class="perfil-avatar" id="img-avatar">`
    : `<div class="perfil-avatar perfil-avatar--vacio" id="img-avatar" aria-label="Avatar">${escapar(iniciales)}</div>`;

  contenido.innerHTML = `
    <div class="perfil-contenedor">
      <section class="tarjeta" aria-labelledby="titulo-datos">
        <h1 class="tarjeta__titulo" id="titulo-datos">Datos Personales</h1>
        <p class="tarjeta__subtitulo">Actualiza tu información y foto de perfil</p>

        <form id="form-perfil" class="pila pila--m" novalidate>
          <div class="perfil-foto-seccion">
            <div id="contenedor-avatar">
              ${avatarHtml}
            </div>
            <div class="perfil-acciones-foto">
              <label for="input-foto" class="btn btn--secundario btn--pequeno" style="cursor: pointer;">
                Cambiar foto
              </label>
              <input type="file" id="input-foto" name="archivo" accept="image/jpeg,image/png,image/webp" style="display: none;">
              <small class="campo__ayuda">JPG, PNG o WEBP (máx. 2 MB)</small>
            </div>
          </div>

          <div class="campo">
            <label for="correo-perfil">Correo electrónico</label>
            <input type="email" id="correo-perfil" value="${escapar(datosPerfil.correo || '')}" disabled style="background-color: var(--fondo); cursor: not-allowed;">
            <small class="campo__ayuda">El correo no puede modificarse directamente.</small>
          </div>

          <div class="campo" id="campo-nombre">
            <label for="nombre">Nombre</label>
            <input type="text" id="nombre" name="nombre" required value="${escapar(datosPerfil.nombre || '')}" aria-describedby="error-nombre">
            <span class="campo__error" id="error-nombre" role="alert"></span>
          </div>

          <div class="campo" id="campo-apellido">
            <label for="apellido">Apellido</label>
            <input type="text" id="apellido" name="apellido" required value="${escapar(datosPerfil.apellido || '')}" aria-describedby="error-apellido">
            <span class="campo__error" id="error-apellido" role="alert"></span>
          </div>

          <button type="submit" id="btn-guardar-perfil" class="btn btn--primario">
            Guardar Cambios
          </button>
        </form>
      </section>

      <section class="tarjeta" aria-labelledby="titulo-clave">
        <h2 class="tarjeta__titulo" id="titulo-clave">Seguridad</h2>
        <p class="tarjeta__subtitulo">Modifica tu contraseña de acceso</p>

        <form id="form-clave" class="pila pila--m" novalidate>
          <div class="campo" id="campo-clave-actual">
            <label for="clave-actual">Contraseña actual</label>
            <input type="password" id="clave-actual" name="actual" required autocomplete="current-password" aria-describedby="error-clave-actual">
            <span class="campo__error" id="error-clave-actual" role="alert"></span>
          </div>

          <div class="campo" id="campo-clave-nueva">
            <label for="clave-nueva">Nueva contraseña</label>
            <input type="password" id="clave-nueva" name="nueva" required autocomplete="new-password" placeholder="Mínimo 8 caracteres, letras y números" aria-describedby="error-clave-nueva">
            <span class="campo__error" id="error-clave-nueva" role="alert"></span>
            <small class="campo__ayuda">Debe combinar letras y números con al menos 8 caracteres.</small>
          </div>

          <div class="campo" id="campo-clave-repetir">
            <label for="clave-repetir">Repetir nueva contraseña</label>
            <input type="password" id="clave-repetir" name="repetir" required autocomplete="new-password" aria-describedby="error-clave-repetir">
            <span class="campo__error" id="error-clave-repetir" role="alert"></span>
          </div>

          <button type="submit" id="btn-cambiar-clave" class="btn btn--primario">
            Actualizar Contraseña
          </button>
        </form>
      </section>
    </div>

    <!-- Sección de logros (se completa en el Sprint 5) -->
    <section id="logros"></section>
  `;

  // Manejo de subida y actualización de foto
  let urlFotoNueva = datosPerfil.foto || null;
  const inputFoto = document.getElementById('input-foto');
  const contAvatar = document.getElementById('contenedor-avatar');

  if (inputFoto) {
    inputFoto.addEventListener('change', async (e) => {
      const archivo = e.target.files && e.target.files[0];
      if (!archivo) return;

      if (archivo.size > 2 * 1024 * 1024) {
        aviso('La imagen supera el límite de 2 MB permitidos.', 'error');
        inputFoto.value = '';
        return;
      }

      try {
        aviso('Subiendo imagen...', 'info');
        const resSubida = await subir(archivo);
        if (resSubida && resSubida.url) {
          urlFotoNueva = resSubida.url;
          contAvatar.innerHTML = `<img src="${escapar(urlFotoNueva)}" alt="Foto de perfil" class="perfil-avatar" id="img-avatar">`;
          aviso('Imagen subida correctamente. Guarda los cambios para conservarla.', 'exito');
        }
      } catch (err) {
        aviso(err.message || 'Error al subir la imagen', 'error');
      }
    });
  }

  // Validación y envío de formulario de perfil
  const formPerfil = document.getElementById('form-perfil');
  const inputNombre = document.getElementById('nombre');
  const inputApellido = document.getElementById('apellido');
  const errorNombre = document.getElementById('error-nombre');
  const errorApellido = document.getElementById('error-apellido');
  const btnGuardarPerfil = document.getElementById('btn-guardar-perfil');

  function validarNombre() {
    if (!inputNombre.value.trim()) {
      errorNombre.textContent = 'El nombre es obligatorio.';
      inputNombre.setAttribute('aria-invalid', 'true');
      return false;
    }
    errorNombre.textContent = '';
    inputNombre.removeAttribute('aria-invalid');
    return true;
  }

  function validarApellido() {
    if (!inputApellido.value.trim()) {
      errorApellido.textContent = 'El apellido es obligatorio.';
      inputApellido.setAttribute('aria-invalid', 'true');
      return false;
    }
    errorApellido.textContent = '';
    inputApellido.removeAttribute('aria-invalid');
    return true;
  }

  inputNombre.addEventListener('input', validarNombre);
  inputApellido.addEventListener('input', validarApellido);

  formPerfil.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validarNombre() || !validarApellido()) return;

    btnGuardarPerfil.disabled = true;
    const txtOriginal = btnGuardarPerfil.textContent;
    btnGuardarPerfil.textContent = 'Guardando...';

    try {
      const cambios = {
        nombre: inputNombre.value.trim(),
        apellido: inputApellido.value.trim(),
        foto: urlFotoNueva
      };

      const actualizado = await llamar('PUT', '/api/auth/perfil', cambios);

      // Actualizar sesión en sessionStorage
      const uActual = usuarioActual() || {};
      const sesionActualizada = {
        ...uActual,
        nombre: actualizado.nombre,
        apellido: actualizado.apellido,
        foto: actualizado.foto || null
      };
      sessionStorage.setItem('usuario', JSON.stringify(sesionActualizada));

      aviso('Perfil actualizado con éxito.', 'exito');

      // Actualizar nombre y avatar visibles en la cabecera si existe
      const usuarioCabecera = document.querySelector('.encabezado__usuario');
      if (usuarioCabecera) {
        const strongNombre = usuarioCabecera.querySelector('strong');
        if (strongNombre) {
          strongNombre.textContent = `${actualizado.nombre} ${actualizado.apellido}`;
        }
        const avatarActual = usuarioCabecera.querySelector('.avatar');
        if (avatarActual) {
          if (actualizado.foto) {
            avatarActual.outerHTML = `<img src="${escapar(actualizado.foto)}" alt="" class="avatar avatar--s" style="border: 2px solid var(--primario);">`;
          } else {
            const inis = `${(actualizado.nombre || '').charAt(0)}${(actualizado.apellido || '').charAt(0)}`.toUpperCase() || 'U';
            avatarActual.outerHTML = `<span class="avatar avatar--s avatar--vacio">${inis}</span>`;
          }
        }
      }
    } catch (err) {
      aviso(err.message || 'Error al actualizar el perfil', 'error');
    } finally {
      btnGuardarPerfil.disabled = false;
      btnGuardarPerfil.textContent = txtOriginal;
    }
  });

  // Validación y envío de formulario de clave
  const formClave = document.getElementById('form-clave');
  const inputActual = document.getElementById('clave-actual');
  const inputNueva = document.getElementById('clave-nueva');
  const inputRepetir = document.getElementById('clave-repetir');
  const errorActual = document.getElementById('error-clave-actual');
  const errorNueva = document.getElementById('error-clave-nueva');
  const errorRepetir = document.getElementById('error-clave-repetir');
  const btnCambiarClave = document.getElementById('btn-cambiar-clave');

  function validarClaveActual() {
    if (!inputActual.value) {
      errorActual.textContent = 'Ingresa tu contraseña actual.';
      inputActual.setAttribute('aria-invalid', 'true');
      return false;
    }
    errorActual.textContent = '';
    inputActual.removeAttribute('aria-invalid');
    return true;
  }

  function validarClaveNueva() {
    const val = inputNueva.value;
    if (!val) {
      errorNueva.textContent = 'Ingresa la nueva contraseña.';
      inputNueva.setAttribute('aria-invalid', 'true');
      return false;
    }
    if (val.length < 8) {
      errorNueva.textContent = 'Debe tener al menos 8 caracteres.';
      inputNueva.setAttribute('aria-invalid', 'true');
      return false;
    }
    if (!/[A-Za-z]/.test(val) || !/\d/.test(val)) {
      errorNueva.textContent = 'Debe contener letras y números.';
      inputNueva.setAttribute('aria-invalid', 'true');
      return false;
    }
    errorNueva.textContent = '';
    inputNueva.removeAttribute('aria-invalid');
    return true;
  }

  function validarClaveRepetir() {
    if (!inputRepetir.value) {
      errorRepetir.textContent = 'Repite la nueva contraseña.';
      inputRepetir.setAttribute('aria-invalid', 'true');
      return false;
    }
    if (inputRepetir.value !== inputNueva.value) {
      errorRepetir.textContent = 'Las contraseñas no coinciden.';
      inputRepetir.setAttribute('aria-invalid', 'true');
      return false;
    }
    errorRepetir.textContent = '';
    inputRepetir.removeAttribute('aria-invalid');
    return true;
  }

  inputActual.addEventListener('input', validarClaveActual);
  inputNueva.addEventListener('input', () => {
    validarClaveNueva();
    if (inputRepetir.value) validarClaveRepetir();
  });
  inputRepetir.addEventListener('input', validarClaveRepetir);

  formClave.addEventListener('submit', async (e) => {
    e.preventDefault();
    const okActual = validarClaveActual();
    const okNueva = validarClaveNueva();
    const okRepetir = validarClaveRepetir();

    if (!okActual || !okNueva || !okRepetir) return;

    btnCambiarClave.disabled = true;
    const txtOriginal = btnCambiarClave.textContent;
    btnCambiarClave.textContent = 'Actualizando...';

    try {
      await llamar('POST', '/api/auth/clave', {
        actual: inputActual.value,
        nueva: inputNueva.value
      });

      aviso('Contraseña actualizada con éxito.', 'exito');
      formClave.reset();
    } catch (err) {
      aviso(err.message || 'Error al actualizar la contraseña', 'error');
    } finally {
      btnCambiarClave.disabled = false;
      btnCambiarClave.textContent = txtOriginal;
    }
  });

  // Sección de logros (exclusiva para estudiantes)
  if (datosPerfil.rol === 'estudiante') {
    const secLogros = document.getElementById('logros');
    if (secLogros) {
      try {
        const [misLogros, todasInsignias, estadoCert] = await Promise.all([
          logrosDe('yo'),
          listar('insignias'),
          llamar('GET', '/api/certificados/estado')
        ]);

        const puntosTotales = (misLogros && typeof misLogros.puntos === 'number') ? misLogros.puntos : 0;
        const insigniasUsuario = (misLogros && Array.isArray(misLogros.insignias)) ? misLogros.insignias : [];
        const mapaObtenidas = new Map();
        insigniasUsuario.forEach(i => {
          if (i && i.id) mapaObtenidas.set(i.id, i.fecha || null);
        });

        // 1. HTML de insignias
        const listaInsigniasHtml = (todasInsignias || []).map(ins => {
          const obtenida = mapaObtenidas.has(ins.id);
          const fechaObt = mapaObtenidas.get(ins.id);
          const fechaTexto = fechaObt ? fechaCorta(fechaObt) : '';

          if (obtenida) {
            return `
              <div class="tarjeta-insignia tarjeta-insignia--desbloqueada">
                <span class="tarjeta-insignia__icono" aria-hidden="true">${escapar(ins.icono || '🏆')}</span>
                <strong class="tarjeta-insignia__nombre">${escapar(ins.nombre)}</strong>
                <span class="tarjeta-insignia__detalle" title="${escapar(ins.descripcion)}">${escapar(ins.descripcion)}</span>
                <span class="insignia insignia--exito tarjeta-insignia__badge">✓ ${fechaTexto ? escapar(fechaTexto) : 'Obtenida'}</span>
              </div>
            `;
          } else {
            return `
              <div class="tarjeta-insignia tarjeta-insignia--bloqueada">
                <span class="tarjeta-insignia__icono" aria-hidden="true">🔒</span>
                <strong class="tarjeta-insignia__nombre">${escapar(ins.nombre)}</strong>
                <span class="tarjeta-insignia__detalle" title="${escapar(ins.descripcion)}">Condición: ${escapar(ins.descripcion)}</span>
                <span class="insignia tarjeta-insignia__badge">Bloqueada</span>
              </div>
            `;
          }
        }).join('');

        // 2. HTML de barras de progreso del certificado
        const condiciones = (estadoCert && Array.isArray(estadoCert.condiciones)) ? estadoCert.condiciones : [];
        const cumpleCertificado = Boolean(estadoCert && estadoCert.cumple);

        const barrasProgresoHtml = condiciones.map(cond => {
          const act = Number(cond.actual) || 0;
          const req = Number(cond.requerido) || 1;
          const pct = Math.min(100, Math.round((act / req) * 100));
          const claseProgreso = cond.cumple ? 'progreso--acento' : '';

          return `
            <div class="condicion-item">
              <div class="condicion-cabecera">
                <span class="condicion-nombre">${escapar(cond.nombre)}</span>
                <strong class="condicion-valores">${act} / ${req} ${cond.cumple ? '✓' : ''}</strong>
              </div>
              <div class="progreso ${claseProgreso}" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapar(cond.nombre)}">
                <div class="progreso__barra" style="width: ${pct}%;"></div>
              </div>
            </div>
          `;
        }).join('');

        secLogros.className = 'tarjeta perfil-logros-seccion';
        secLogros.innerHTML = `
          <header class="perfil-logros-cabecera">
            <div>
              <h2 class="perfil-logros-titulo">Mis Logros y Gamificación</h2>
              <p class="perfil-logros-subtitulo">Progreso acumulado, colección de insignias y certificaciones oficiales.</p>
            </div>
            <div class="perfil-puntos-badge">
              <span class="perfil-puntos-icono">⭐</span>
              <div>
                <span class="perfil-puntos-etiqueta">PUNTOS TOTALES</span>
                <div class="perfil-puntos-valor">${puntosTotales} pts</div>
              </div>
            </div>
          </header>

          <div class="pila pila--l" style="margin-top: var(--espacio-l);">
            <!-- Vitrina de insignias -->
            <section aria-labelledby="titulo-vitrina-insignias">
              <h3 id="titulo-vitrina-insignias" style="margin: 0 0 var(--espacio-s) 0; font-size: var(--tamano-l); color: var(--primario);">
                Insignias Académicas
              </h3>
              <div class="vitrina-insignias-grid" role="list">
                ${listaInsigniasHtml}
              </div>
            </section>

            <!-- Certificado de cumplimiento -->
            <section class="certificado-cumplimiento-bloque" aria-labelledby="titulo-cert-cumplimiento">
              <div class="certificado-cabecera">
                <div>
                  <h3 id="titulo-cert-cumplimiento" style="margin: 0; font-size: var(--tamano-l); color: var(--primario);">
                    Certificado de Cumplimiento
                  </h3>
                  <p style="margin: var(--espacio-xs) 0 0; font-size: var(--tamano-s); color: var(--texto-suave);">
                    Completa todos los requisitos de actividades formativas para descargar tu acreditación oficial.
                  </p>
                </div>
                <button type="button"
                        id="btn-descargar-cert-cumplimiento"
                        class="btn btn--primario"
                        ${cumpleCertificado ? '' : 'disabled'}
                        title="${cumpleCertificado ? 'Descargar tu diploma en PDF' : 'Debes cumplir todas las condiciones para desbloquearlo'}">
                  Descargar certificado
                </button>
              </div>

              <div class="condiciones-lista">
                ${barrasProgresoHtml}
              </div>
            </section>
          </div>
        `;

        const btnDescargar = document.getElementById('btn-descargar-cert-cumplimiento');
        if (btnDescargar && cumpleCertificado) {
          btnDescargar.addEventListener('click', async () => {
            btnDescargar.disabled = true;
            const originalTexto = btnDescargar.textContent;
            btnDescargar.textContent = 'Generando diploma...';
            try {
              cargando(true);
              await generarDiploma({ tipo: 'cumplimiento' });
            } catch (err) {
              aviso(err.message || 'Error al emitir el certificado', 'error');
            } finally {
              cargando(false);
              btnDescargar.disabled = false;
              btnDescargar.textContent = originalTexto;
            }
          });
        }
      } catch (errLogros) {
        console.error('Error al cargar logros del usuario:', errLogros);
      }
    }
  }
}
