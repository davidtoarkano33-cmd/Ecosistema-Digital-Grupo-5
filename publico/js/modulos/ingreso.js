// publico/js/modulos/ingreso.js · Lógica de inicio de sesión con validación en vivo
import { montarPlantilla } from '../nucleo/plantilla.js';
import { iniciar, usuarioActual } from '../nucleo/sesion.js';
import { aviso } from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Iniciar Sesión" });

if (usuarioActual()) {
  window.location.href = '/index.html';
}

const contenido = document.getElementById('contenido');
if (contenido) {
  contenido.innerHTML = `
    <div class="auth-contenedor">
      <div class="tarjeta auth-tarjeta">
        <h1 class="tarjeta__titulo">Iniciar Sesión</h1>
        <p class="tarjeta__subtitulo">Ingresa tus credenciales para acceder a la plataforma</p>

        <form id="form-ingreso" novalidate class="pila pila--m">
          <div class="campo" id="campo-correo">
            <label for="correo">Correo electrónico</label>
            <input type="email" id="correo" name="correo" autocomplete="email" required placeholder="ejemplo@unemi.edu.ec" aria-describedby="error-correo">
            <span class="campo__error" id="error-correo" role="alert"></span>
          </div>

          <div class="campo" id="campo-clave">
            <label for="clave">Contraseña</label>
            <input type="password" id="clave" name="clave" autocomplete="current-password" required placeholder="Tu contraseña" aria-describedby="error-clave">
            <span class="campo__error" id="error-clave" role="alert"></span>
          </div>

          <button type="submit" id="btn-ingresar" class="btn btn--primario" style="width: 100%;">
            Ingresar
          </button>
        </form>

        <div class="auth-pie">
          ¿No tienes una cuenta? <a href="/paginas/registro.html">Regístrate aquí</a>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('form-ingreso');
  const inputCorreo = document.getElementById('correo');
  const inputClave = document.getElementById('clave');
  const errorCorreo = document.getElementById('error-correo');
  const errorClave = document.getElementById('error-clave');
  const btnIngresar = document.getElementById('btn-ingresar');

  function validarCorreo() {
    const valor = inputCorreo.value.trim();
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!valor) {
      errorCorreo.textContent = 'El correo electrónico es obligatorio.';
      inputCorreo.setAttribute('aria-invalid', 'true');
      return false;
    }
    if (!regex.test(valor)) {
      errorCorreo.textContent = 'Ingresa un correo electrónico válido.';
      inputCorreo.setAttribute('aria-invalid', 'true');
      return false;
    }
    errorCorreo.textContent = '';
    inputCorreo.removeAttribute('aria-invalid');
    return true;
  }

  function validarClave() {
    const valor = inputClave.value;
    if (!valor) {
      errorClave.textContent = 'La contraseña es obligatoria.';
      inputClave.setAttribute('aria-invalid', 'true');
      return false;
    }
    errorClave.textContent = '';
    inputClave.removeAttribute('aria-invalid');
    return true;
  }

  inputCorreo.addEventListener('input', validarCorreo);
  inputClave.addEventListener('input', validarClave);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const okCorreo = validarCorreo();
    const okClave = validarClave();

    if (!okCorreo || !okClave) {
      return;
    }

    btnIngresar.disabled = true;
    const textoOriginal = btnIngresar.textContent;
    btnIngresar.textContent = 'Ingresando...';

    try {
      const usuario = await iniciar(inputCorreo.value.trim(), inputClave.value);
      sessionStorage.setItem('aviso_pendiente', JSON.stringify({
        texto: `¡Bienvenido/a, ${usuario.nombre}!`,
        tipo: 'exito'
      }));
      window.location.href = '/index.html';
    } catch (err) {
      aviso(err.message || 'Error al iniciar sesión', 'error');
      btnIngresar.disabled = false;
      btnIngresar.textContent = textoOriginal;
    }
  });
}
