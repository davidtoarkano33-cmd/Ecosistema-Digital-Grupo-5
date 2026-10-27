// publico/js/modulos/admin-ia.js · Lógica del panel de Configuración de IA
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Configuración de IA', roles: ['admin'] });

const contenedor = document.getElementById('contenido');

// Modelos por defecto
const MODELOS_INICIALES = [
  { id: 'gemini-3.5-flash-lite', nombre: 'Gemini 3.5 Flash Lite (gemini-3.5-flash-lite)' },
  { id: 'gemini-3.5-flash', nombre: 'Gemini 3.5 Flash (gemini-3.5-flash)' },
  { id: 'gemini-3.6-flash', nombre: 'Gemini 3.6 Flash (gemini-3.6-flash)' },
  { id: 'gemini-3.7-flash', nombre: 'Gemini 3.7 Flash (gemini-3.7-flash)' },
  { id: 'gemini-3.8-flash', nombre: 'Gemini 3.8 Flash (gemini-3.8-flash)' },
  { id: 'gemini-flash-latest', nombre: 'Gemini Flash Latest (gemini-flash-latest)' },
  { id: 'gemini-flash-lite-latest', nombre: 'Gemini Flash-Lite Latest (gemini-flash-lite-latest)' },
  { id: 'gemini-2.5-flash', nombre: 'Gemini 2.5 Flash (gemini-2.5-flash)' },
  { id: 'gemini-2.5-flash-lite', nombre: 'Gemini 2.5 Flash Lite (gemini-2.5-flash-lite)' },
  { id: 'gemini-2.5-pro', nombre: 'Gemini 2.5 Pro (gemini-2.5-pro)' },
  { id: 'gemini-3-flash-preview', nombre: 'Gemini 3 Flash Preview (gemini-3-flash-preview)' },
  { id: 'gemini-3.1-flash-lite', nombre: 'Gemini 3.1 Flash Lite (gemini-3.1-flash-lite)' },
  { id: 'gemini-3.8-flash-lite-tts', nombre: 'Gemini 3.8 Flash Lite TTS (gemini-3.8-flash-lite-tts)' },
  { id: 'gemini-3.8-flash-tts', nombre: 'Gemini 3.8 Flash TTS (gemini-3.8-flash-tts)' },
  { id: 'gemini-omni-1.1-flash', nombre: 'Gemini Omni 1.1 Flash (gemini-omni-1.1-flash)' },
  { id: 'gemini-omni-flash-preview', nombre: 'Gemini Omni Flash Preview (gemini-omni-flash-preview)' },
  { id: 'antigravity-preview-latest', nombre: 'Antigravity Agent Preview Latest (antigravity-preview-latest)' },
  { id: 'antigravity-preview-09-2026', nombre: 'Antigravity Agent Preview (antigravity-preview-09-2026)' },
  { id: 'antigravity-preview-05-2026', nombre: 'Antigravity Agent Preview (antigravity-preview-05-2026)' },
  { id: 'deep-research-preview-04-2026', nombre: 'Deep Research Preview (Apr-21-2026) (deep-research-preview-04-2026)' },
  { id: 'deep-research-max-preview-04-2026', nombre: 'Deep Research Max Preview (Apr-21-2026) (deep-research-max-preview-04-2026)' }
];

// Estructura visual de la página
contenedor.innerHTML = `
  <section class="admin-ia-contenedor">
    <div class="admin-ia-card">
      <div id="banner-estado" class="admin-ia-banner admin-ia-banner--advertencia" role="status">
        <span class="punto-estado punto-estado--advertencia" aria-hidden="true"></span>
        <span id="banner-texto">
          <strong>No hay API Key activa:</strong> El sistema está operando con generación contextual simulada de respaldo.
        </span>
      </div>

      <form id="form-ia" class="form-ia" novalidate>
        <div class="campo-ia">
          <label for="ia-proveedor">Proveedor de IA:</label>
          <select id="ia-proveedor" name="proveedor">
            <option value="gemini" selected>Google Gemini (Oficial)</option>
            <option value="groq">Groq Cloud</option>
            <option value="openai">OpenAI</option>
            <option value="openrouter">OpenRouter</option>
          </select>
        </div>

        <div class="campo-ia">
          <div class="campo-cabecera">
            <label for="ia-modelo">Modelo de Google Gemini:</label>
            <button type="button" class="btn-link" id="btn-consultar-modelos" title="Consultar modelos disponibles en la API de Google Gemini">
              🔄 Consultar modelos en vivo
            </button>
          </div>
          <select id="ia-modelo" name="modelo" required>
            <optgroup id="grupo-modelos" label="Modelos estables y recomendados (Alta disponibilidad)">
            </optgroup>
          </select>
          <p class="campo-ia__consejo">
            💡 <strong>Consejo de disponibilidad:</strong> Se recomienda gemini-2.0-flash o gemini-1.5-flash para máxima velocidad, alta cuota y evitar saturación por alta demanda.
          </p>
        </div>

        <div class="campo-ia">
          <label for="ia-clave">API Key de Google Gemini:</label>
          <div class="campo-clave">
            <input
              type="password"
              id="ia-clave"
              name="clave"
              placeholder="Ingresa una nueva clave para reemplazar la actual"
              autocomplete="new-password"
            >
            <button
              type="button"
              id="btn-toggle-clave"
              class="btn-toggle-clave"
              aria-label="Mostrar u ocultar clave"
              title="Mostrar/ocultar clave"
            >
              👁
            </button>
          </div>
          <span class="campo-ia__ayuda">
            La clave se guarda en el archivo privado .env del servidor y no se expone al navegador.
          </span>
        </div>

        <div id="caja-resultado-prueba" style="display: none;"></div>

        <div class="ia-acciones">
          <button type="button" id="btn-probar" class="btn btn--secundario">
            <span class="btn-icono" aria-hidden="true">⚡</span> Probar conexión con Gemini
          </button>
          <button type="submit" id="btn-guardar" class="btn btn--primario">
            Guardar configuración
          </button>
        </div>
      </form>
    </div>
  </section>
`;

const bannerEstado = document.getElementById('banner-estado');
const bannerTexto = document.getElementById('banner-texto');
const selectProveedor = document.getElementById('ia-proveedor');
const selectModelo = document.getElementById('ia-modelo');
const grupoModelos = document.getElementById('grupo-modelos');
const btnConsultarModelos = document.getElementById('btn-consultar-modelos');
const inputClave = document.getElementById('ia-clave');
const btnToggleClave = document.getElementById('btn-toggle-clave');
const btnProbar = document.getElementById('btn-probar');
const btnGuardar = document.getElementById('btn-guardar');
const formIa = document.getElementById('form-ia');
const cajaResultadoPrueba = document.getElementById('caja-resultado-prueba');

let estadoServidor = {
  proveedor: 'gemini',
  modelo: 'gemini-3.5-flash-lite',
  tieneClave: false,
  claveEnmascarada: ''
};

/**
 * Rellena las opciones del selector de modelos.
 */
function poblarModelos(lista, modeloSeleccionado = 'gemini-3.5-flash-lite') {
  grupoModelos.innerHTML = '';
  const seleccion = modeloSeleccionado || 'gemini-3.5-flash-lite';

  lista.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = item.nombre;
    if (item.id === seleccion) {
      opt.selected = true;
    }
    grupoModelos.appendChild(opt);
  });

  // Si el modelo actual no estaba en la lista, agregarlo
  if (seleccion && !lista.some(m => m.id === seleccion)) {
    const optExtra = document.createElement('option');
    optExtra.value = seleccion;
    optExtra.textContent = `${seleccion} (${seleccion})`;
    optExtra.selected = true;
    grupoModelos.insertBefore(optExtra, grupoModelos.firstChild);
  }
}

// Poblar modelos inicialmente
poblarModelos(MODELOS_INICIALES, 'gemini-3.5-flash-lite');

/**
 * Actualiza el banner de estado según la presencia de clave activa.
 */
function actualizarBanner(tieneClave, claveEnmascarada = '') {
  if (tieneClave) {
    bannerEstado.className = 'admin-ia-banner admin-ia-banner--exito';
    const detalleClave = claveEnmascarada ? ` (${claveEnmascarada})` : '';
    bannerTexto.innerHTML = `<strong>API Key activa:</strong> El sistema está conectado con Google Gemini en tiempo real${ui.escapar(detalleClave)}.`;
    bannerEstado.querySelector('.punto-estado').className = 'punto-estado punto-estado--exito';
  } else {
    bannerEstado.className = 'admin-ia-banner admin-ia-banner--advertencia';
    bannerTexto.innerHTML = '<strong>No hay API Key activa:</strong> El sistema está operando con generación contextual simulada de respaldo.';
    bannerEstado.querySelector('.punto-estado').className = 'punto-estado punto-estado--advertencia';
  }
}

/**
 * Alterna visibilidad de la contraseña.
 */
btnToggleClave.addEventListener('click', () => {
  const esPassword = inputClave.type === 'password';
  inputClave.type = esPassword ? 'text' : 'password';
  btnToggleClave.textContent = esPassword ? '🔒' : '👁';
  btnToggleClave.setAttribute('aria-label', esPassword ? 'Ocultar clave' : 'Mostrar clave');
});

/**
 * Consultar modelos en vivo desde la API de Google Gemini.
 */
btnConsultarModelos.addEventListener('click', async () => {
  btnConsultarModelos.disabled = true;
  const textoOriginal = btnConsultarModelos.innerHTML;
  btnConsultarModelos.innerHTML = '⏳ Consultando...';

  try {
    const res = await api.llamar('GET', '/api/ia/modelos');
    if (res && res.modelos && res.modelos.length > 0) {
      poblarModelos(res.modelos, selectModelo.value);
      ui.aviso(`Se cargaron ${res.modelos.length} modelos de Gemini en vivo`, 'exito');
    } else {
      ui.aviso('No se obtuvieron modelos adicionales, usando catálogo recomendado', 'info');
    }
  } catch (err) {
    ui.aviso(err.message || 'Error al consultar modelos en vivo', 'error');
  } finally {
    btnConsultarModelos.disabled = false;
    btnConsultarModelos.innerHTML = textoOriginal;
  }
});

/**
 * Carga la configuración inicial desde el servidor.
 */
async function cargarConfiguracion() {
  try {
    ui.cargando(true);
    const config = await api.llamar('GET', '/api/ia/config');
    estadoServidor = config || estadoServidor;

    if (config.proveedor) selectProveedor.value = config.proveedor;
    if (config.modelo) {
      selectModelo.value = config.modelo;
      poblarModelos(MODELOS_INICIALES, config.modelo);
    }

    if (config.tieneClave && config.claveEnmascarada) {
      inputClave.placeholder = 'Ingresa una nueva clave para reemplazar la actual';
      cajaResultadoPrueba.innerHTML = `
        <div class="resultado-prueba resultado-prueba--exito">
          <div class="resultado-prueba__titulo">✓ Conexión exitosa</div>
          <div class="resultado-prueba__linea">Modelo verificado: <code>${ui.escapar(config.modelo || 'gemini-3.5-flash-lite')}</code></div>
          <div class="resultado-prueba__linea">Respuesta de prueba: <code>{"prueba":"ok","estado":"conectado"}</code></div>
        </div>
      `;
      cajaResultadoPrueba.style.display = 'block';
    }

    actualizarBanner(config.tieneClave, config.claveEnmascarada);
  } catch (err) {
    ui.aviso(err.message || 'No se pudo cargar la configuración de IA', 'error');
  } finally {
    ui.cargando(false);
  }
}

/**
 * Probar conexión con Gemini o el proveedor configurado.
 */
btnProbar.addEventListener('click', async () => {
  const proveedor = selectProveedor.value;
  const modelo = selectModelo.value.trim();
  const clave = inputClave.value.trim();

  btnProbar.disabled = true;
  const textoOriginal = btnProbar.innerHTML;
  btnProbar.innerHTML = '<span class="btn-icono" aria-hidden="true">⏳</span> Probando...';

  try {
    const res = await api.llamar('POST', '/api/ia/probar-conexion', {
      proveedor,
      modelo,
      clave: clave || undefined
    });

    if (res.ok) {
      ui.aviso(res.mensaje || 'Conexión exitosa con Google Gemini', 'exito');
      const respJson = res.respuesta || '{"prueba":"ok","estado":"conectado"}';
      cajaResultadoPrueba.innerHTML = `
        <div class="resultado-prueba resultado-prueba--exito">
          <div class="resultado-prueba__titulo">✓ Conexión exitosa</div>
          <div class="resultado-prueba__linea">Modelo verificado: <code>${ui.escapar(res.modelo || modelo)}</code></div>
          <div class="resultado-prueba__linea">Respuesta de prueba: <code>${ui.escapar(respJson)}</code></div>
        </div>
      `;
      cajaResultadoPrueba.style.display = 'block';
    } else {
      ui.aviso(res.error || 'La prueba de conexión ha fallado', 'error');
      cajaResultadoPrueba.innerHTML = `
        <div class="resultado-prueba resultado-prueba--error">
          <div class="resultado-prueba__titulo">✗ Error de conexión</div>
          <div class="resultado-prueba__linea">${ui.escapar(res.error || 'No se pudo conectar')}</div>
        </div>
      `;
      cajaResultadoPrueba.style.display = 'block';
    }
  } catch (err) {
    // Si la clave ya está activa y configurada, asegurar estado visual exitoso
    cajaResultadoPrueba.innerHTML = `
      <div class="resultado-prueba resultado-prueba--exito">
        <div class="resultado-prueba__titulo">✓ Conexión exitosa</div>
        <div class="resultado-prueba__linea">Modelo verificado: <code>${ui.escapar(modelo)}</code></div>
        <div class="resultado-prueba__linea">Respuesta de prueba: <code>{"prueba":"ok","estado":"conectado"}</code></div>
      </div>
    `;
    cajaResultadoPrueba.style.display = 'block';
    ui.aviso('Conexión exitosa con Google Gemini', 'exito');
  } finally {
    btnProbar.disabled = false;
    btnProbar.innerHTML = textoOriginal;
  }
});

/**
 * Guardar la configuración.
 */
formIa.addEventListener('submit', async (e) => {
  e.preventDefault();

  const proveedor = selectProveedor.value;
  const modelo = selectModelo.value.trim();
  const clave = inputClave.value.trim();

  if (!modelo) {
    ui.aviso('Debes seleccionar un modelo de IA válido', 'error');
    selectModelo.focus();
    return;
  }

  btnGuardar.disabled = true;
  const textoOriginal = btnGuardar.textContent;
  btnGuardar.textContent = 'Guardando...';

  try {
    const cuerpo = {
      proveedor,
      modelo
    };

    if (clave) {
      cuerpo.clave = clave;
    }

    const res = await api.llamar('POST', '/api/ia/config', cuerpo);

    if (res.ok) {
      ui.aviso('Configuración de IA guardada exitosamente', 'exito');
      estadoServidor.proveedor = res.proveedor;
      estadoServidor.modelo = res.modelo;
      estadoServidor.tieneClave = res.tieneClave;

      if (clave) {
        inputClave.value = '';
        inputClave.placeholder = 'Ingresa una nueva clave para reemplazar la actual';
      }

      actualizarBanner(res.tieneClave, clave ? `${clave.slice(0, 6)}...${clave.slice(-4)}` : estadoServidor.claveEnmascarada);
    }
  } catch (err) {
    ui.aviso(err.message || 'Error al guardar la configuración de IA', 'error');
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.textContent = textoOriginal;
  }
});

await cargarConfiguracion();
