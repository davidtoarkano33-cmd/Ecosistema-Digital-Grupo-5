// publico/js/modulos/registro.js · Lógica de registro de usuario con validación en vivo
import { montarPlantilla } from '../nucleo/plantilla.js';
import { registrar, iniciar, usuarioActual } from '../nucleo/sesion.js';
import { aviso } from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Registro de Usuario" });

if (usuarioActual()) {
  window.location.href = '/index.html';
}

const contenido = document.getElementById('contenido');
if (contenido) {
  contenido.innerHTML = `
    <div class="auth-contenedor">
      <div class="tarjeta auth-tarjeta">
        <h1 class="tarjeta__titulo">Crear una Cuenta</h1>
        <p class="tarjeta__subtitulo">Regístrate para acceder a los contenidos, actividades y tutoría virtual</p>

        <form id="form-registro" novalidate class="pila pila--m">
          <div class="fila" style="gap: var(--espacio-m);">
            <div class="campo" id="campo-nombre" style="flex: 1; min-width: 200px;">
              <label for="nombre">Nombre</label>
              <input type="text" id="nombre" name="nombre" autocomplete="given-name" required placeholder="Tu nombre" aria-describedby="error-nombre">
              <span class="campo__error" id="error-nombre" role="alert"></span>
            </div>

            <div class="campo" id="campo-apellido" style="flex: 1; min-width: 200px;">
              <label for="apellido">Apellido</label>
              <input type="text" id="apellido" name="apellido" autocomplete="family-name" required placeholder="Tu apellido" aria-describedby="error-apellido">
              <span class="campo__error" id="error-apellido" role="alert"></span>
            </div>
          </div>

          <div class="campo" id="campo-correo">
            <label for="correo">Correo electrónico</label>
            <input type="email" id="correo" name="correo" autocomplete="email" required placeholder="estudiante@unemi.edu.ec" aria-describedby="error-correo">
            <span class="campo__error" id="error-correo" role="alert"></span>
          </div>

          <div class="campo" id="campo-clave">
            <label for="clave">Contraseña</label>
            <input type="password" id="clave" name="clave" autocomplete="new-password" required placeholder="Mínimo 8 caracteres con letras y números" aria-describedby="error-clave">
            <span class="campo__error" id="error-clave" role="alert"></span>
            <small class="campo__ayuda">Debe contener al menos 8 caracteres, combinando letras y números.</small>
          </div>

          <div class="campo campo--casilla" id="campo-consentimiento">
            <input type="checkbox" id="consentimiento" name="consentimiento" required aria-describedby="error-consentimiento">
            <label for="consentimiento">
              Acepto el <a href="/paginas/privacidad.html" target="_blank" rel="noopener">aviso de privacidad</a> y el tratamiento de mis datos personales según la LOPDP del Ecuador.
            </label>
          </div>
          <span class="campo__error" id="error-consentimiento" role="alert" style="margin-top: calc(-1 * var(--espacio-s));"></span>

          <button type="submit" id="btn-registrarse" class="btn btn--primario" style="width: 100%;">
            Registrarse e Iniciar
          </button>
        </form>

        <div class="auth-pie">
          ¿Ya tienes una cuenta? <a href="/paginas/ingreso.html">Inicia sesión aquí</a>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('form-registro');
  const inputNombre = document.getElementById('nombre');
  const inputApellido = document.getElementById('apellido');
  const inputCorreo = document.getElementById('correo');
  const inputClave = document.getElementById('clave');
  const inputConsentimiento = document.getElementById('consentimiento');

  const errorNombre = document.getElementById('error-nombre');
  const errorApellido = document.getElementById('error-apellido');
  const errorCorreo = document.getElementById('error-correo');
  const errorClave = document.getElementById('error-clave');
  const errorConsentimiento = document.getElementById('error-consentimiento');
  const btnRegistrarse = document.getElementById('btn-registrarse');

  function validarNombre() {
    const val = inputNombre.value.trim();
    if (!val) {
      errorNombre.textContent = 'El nombre es obligatorio.';
      inputNombre.setAttribute('aria-invalid', 'true');
      return false;
    }
    errorNombre.textContent = '';
    inputNombre.removeAttribute('aria-invalid');
    return true;
  }

  function validarApellido() {
    const val = inputApellido.value.trim();
    if (!val) {
      errorApellido.textContent = 'El apellido es obligatorio.';
      inputApellido.setAttribute('aria-invalid', 'true');
      return false;
    }
    errorApellido.textContent = '';
    inputApellido.removeAttribute('aria-invalid');
    return true;
  }

  function validarCorreo() {
    const val = inputCorreo.value.trim();
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!val) {
      errorCorreo.textContent = 'El correo electrónico es obligatorio.';
      inputCorreo.setAttribute('aria-invalid', 'true');
      return false;
    }
    if (!regex.test(val)) {
      errorCorreo.textContent = 'Ingresa un correo electrónico con formato válido.';
      inputCorreo.setAttribute('aria-invalid', 'true');
      return false;
    }
    errorCorreo.textContent = '';
    inputCorreo.removeAttribute('aria-invalid');
    return true;
  }

  function validarClave() {
    const val = inputClave.value;
    if (!val) {
      errorClave.textContent = 'La contraseña es obligatoria.';
      inputClave.setAttribute('aria-invalid', 'true');
      return false;
    }
    if (val.length < 8) {
      errorClave.textContent = 'La contraseña debe tener al menos 8 caracteres.';
      inputClave.setAttribute('aria-invalid', 'true');
      return false;
    }
    if (!/[A-Za-z]/.test(val) || !/\d/.test(val)) {
      errorClave.textContent = 'La contraseña debe combinar letras y números.';
      inputClave.setAttribute('aria-invalid', 'true');
      return false;
    }
    errorClave.textContent = '';
    inputClave.removeAttribute('aria-invalid');
    return true;
  }

  function validarConsentimiento() {
    if (!inputConsentimiento.checked) {
      errorConsentimiento.textContent = 'Debes aceptar el aviso de privacidad para continuar.';
      inputConsentimiento.setAttribute('aria-invalid', 'true');
      return false;
    }
    errorConsentimiento.textContent = '';
    inputConsentimiento.removeAttribute('aria-invalid');
    return true;
  }

  inputNombre.addEventListener('input', validarNombre);
  inputApellido.addEventListener('input', validarApellido);
  inputCorreo.addEventListener('input', validarCorreo);
  inputClave.addEventListener('input', validarClave);
  inputConsentimiento.addEventListener('change', validarConsentimiento);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const okNombre = validarNombre();
    const okApellido = validarApellido();
    const okCorreo = validarCorreo();
    const okClave = validarClave();
    const okConsentimiento = validarConsentimiento();

    if (!okNombre || !okApellido || !okCorreo || !okClave || !okConsentimiento) {
      return;
    }

    btnRegistrarse.disabled = true;
    const textoOriginal = btnRegistrarse.textContent;
    btnRegistrarse.textContent = 'Registrando...';

    const correo = inputCorreo.value.trim();
    const clave = inputClave.value;

    try {
      await registrar({
        nombre: inputNombre.value.trim(),
        apellido: inputApellido.value.trim(),
        correo,
        clave,
        consentimiento: true
      });

      // Inicio de sesión automático tras el registro
      const usuario = await iniciar(correo, clave);

      sessionStorage.setItem('aviso_pendiente', JSON.stringify({
        texto: `¡Cuenta creada con éxito! Bienvenido/a, ${usuario.nombre}.`,
        tipo: 'exito'
      }));

      window.location.href = '/index.html';
    } catch (err) {
      aviso(err.message || 'Error al completar el registro', 'error');
      btnRegistrarse.disabled = false;
      btnRegistrarse.textContent = textoOriginal;
    }
  });
}
