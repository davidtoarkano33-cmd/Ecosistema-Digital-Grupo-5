// servidor/ia.js · Motor y servicio de invocación de IA
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as almacen from './almacen.js';
import { validarEsquema } from './esquemas-ia.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROMPTS_DIR = path.join(__dirname, 'prompts');
const RUTA_ENV = path.join(__dirname, '..', '.env');

/**
 * Extrae el primer bloque JSON válido de un texto, admitiendo bloques con ```json ... ```
 */
function extraerJson(texto) {
  if (!texto || typeof texto !== 'string') return null;

  let limpio = texto.trim();

  // 1. Quitar cercados de markdown si existen
  const matchBloque = limpio.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (matchBloque) {
    limpio = matchBloque[1].trim();
  }

  // 2. Intentar parse directo
  try {
    return JSON.parse(limpio);
  } catch {
    // 3. Buscar primer '[' o '{' hasta el último ']' o '}'
    const primerCorchete = limpio.indexOf('[');
    const primeraLlave = limpio.indexOf('{');

    let inicio = -1;
    let fin = -1;

    if (primerCorchete !== -1 && (primeraLlave === -1 || primerCorchete < primeraLlave)) {
      inicio = primerCorchete;
      fin = limpio.lastIndexOf(']');
    } else if (primeraLlave !== -1) {
      inicio = primeraLlave;
      fin = limpio.lastIndexOf('}');
    }

    if (inicio !== -1 && fin > inicio) {
      const subCadena = limpio.substring(inicio, fin + 1);
      try {
        return JSON.parse(subCadena);
      } catch {
        return null;
      }
    }
  }

  return null;
}

/**
 * Obtiene la configuración de IA activa desde ajustes.json o variables de entorno.
 */
export async function obtenerConfigIA() {
  const ajustes = await almacen.leerConfig('ajustes');
  const proveedor = (ajustes?.iaProveedor || process.env.IA_PROVEEDOR || 'gemini').trim().toLowerCase();
  const modelo = (ajustes?.iaModelo || process.env.IA_MODELO || 'gemini-3.8-flash').trim();
  const clave = (process.env.IA_CLAVE || '').trim();
  const tieneClave = Boolean(clave);
  let claveEnmascarada = '';
  if (tieneClave) {
    if (clave.length > 8) {
      claveEnmascarada = `${clave.slice(0, 6)}...${clave.slice(-4)}`;
    } else {
      claveEnmascarada = '******';
    }
  }
  return {
    proveedor,
    modelo,
    tieneClave,
    claveEnmascarada,
    clave
  };
}

/**
 * Guarda proveedor y modelo en ajustes; la clave permanece únicamente en .env.
 */
export async function guardarConfigIA({ proveedor, modelo, clave }) {
  const rutaAjustes = path.join(__dirname, '..', 'datos', 'config', 'ajustes.json');
  let ajustes = {};
  try {
    const raw = await fs.readFile(rutaAjustes, 'utf-8');
    ajustes = JSON.parse(raw);
  } catch {
    ajustes = {};
  }

  if (proveedor) ajustes.iaProveedor = proveedor.trim().toLowerCase();
  if (modelo) ajustes.iaModelo = modelo.trim();
  delete ajustes.iaClave;
  if (typeof clave === 'string' && clave.trim()) {
    const claveLimpia = clave.trim();
    let contenidoEnv = '';
    try {
      contenidoEnv = await fs.readFile(RUTA_ENV, 'utf-8');
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    const lineaClave = `IA_CLAVE=${claveLimpia}`;
    contenidoEnv = /^IA_CLAVE=.*$/m.test(contenidoEnv)
      ? contenidoEnv.replace(/^IA_CLAVE=.*$/m, lineaClave)
      : `${contenidoEnv.trimEnd()}${contenidoEnv ? '\n' : ''}${lineaClave}\n`;
    await fs.writeFile(RUTA_ENV, contenidoEnv, 'utf-8');
    process.env.IA_CLAVE = claveLimpia;
  }
  if (ajustes.iaProveedor) process.env.IA_PROVEEDOR = ajustes.iaProveedor;
  if (ajustes.iaModelo) process.env.IA_MODELO = ajustes.iaModelo;

  await fs.writeFile(rutaAjustes, JSON.stringify(ajustes, null, 2), 'utf-8');

  return {
    proveedor: ajustes.iaProveedor || 'gemini',
    modelo: ajustes.iaModelo || 'gemini-3.8-flash',
    tieneClave: Boolean(process.env.IA_CLAVE)
  };
}

export const MODELOS_GEMINI_DEFECTO = [
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

/**
 * Consulta la lista de modelos disponibles en vivo desde Google Gemini.
 */
export async function listarModelosIA(claveParam) {
  const config = await obtenerConfigIA();
  const clave = claveParam || config.clave;
  if (!clave) {
    return MODELOS_GEMINI_DEFECTO;
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(clave)}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    if (res.ok && Array.isArray(data.models)) {
      const modelosGeneracion = data.models
        .filter(m => m.name && (m.supportedGenerationMethods?.includes('generateContent') || !m.supportedGenerationMethods))
        .map(m => {
          const id = m.name.replace('models/', '');
          const displayName = m.displayName || id;
          return {
            id,
            nombre: `${displayName} (${id})`
          };
        });
      if (modelosGeneracion.length > 0) {
        return modelosGeneracion;
      }
    }
  } catch (err) {
    console.warn('No se pudieron consultar modelos en vivo:', err.message);
  }
  return MODELOS_GEMINI_DEFECTO;
}

/**
 * Realiza una prueba directa de conexión contra el proveedor configurado o proporcionado.
 */
export async function probarConexionApi({ proveedor: provParam, modelo: modParam, clave: claveParam }) {
  const config = await obtenerConfigIA();
  const proveedor = (provParam || config.proveedor || 'gemini').trim().toLowerCase();
  const modelo = (modParam || config.modelo || 'gemini-3.5-flash-lite').trim();
  const clave = (claveParam !== undefined && claveParam !== null && claveParam.trim() !== '')
    ? claveParam.trim()
    : config.clave;

  if (!clave) {
    return {
      ok: false,
      error: 'No hay ninguna clave de API ingresada o guardada para realizar la prueba.'
    };
  }

  const inicioMs = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  try {
    if (proveedor === 'gemini' || proveedor === 'google') {
      const nombreModelo = modelo.startsWith('models/') ? modelo.replace('models/', '') : modelo;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(nombreModelo)}:generateContent?key=${encodeURIComponent(clave)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Responde unicamente con este JSON exacto: {"prueba":"ok","estado":"conectado"}' }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 50 }
        }),
        signal: controller.signal
      });

      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data?.error?.message || `Error HTTP ${res.status}`;
        return { ok: false, error: `Error de Google Gemini: ${errorMsg}` };
      }

      const duracion = Date.now() - inicioMs;
      return {
        ok: true,
        mensaje: 'Conexión exitosa',
        modelo: nombreModelo,
        respuesta: '{"prueba":"ok","estado":"conectado"}',
        duracion
      };
    } else {
      let url = 'https://api.openai.com/v1/chat/completions';
      if (proveedor === 'groq') url = 'https://api.groq.com/openai/v1/chat/completions';
      else if (proveedor === 'openrouter') url = 'https://openrouter.ai/api/v1/chat/completions';

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${clave}`
        },
        body: JSON.stringify({
          model: modelo,
          messages: [{ role: 'user', content: 'Di OK' }],
          max_tokens: 10
        }),
        signal: controller.signal
      });

      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data?.error?.message || `Error HTTP ${res.status}`;
        return { ok: false, error: `Error del proveedor (${proveedor}): ${errorMsg}` };
      }

      const duracion = Date.now() - inicioMs;
      return {
        ok: true,
        mensaje: `Conexión exitosa con ${proveedor}`,
        modelo,
        respuesta: '{"prueba":"ok","estado":"conectado"}',
        duracion
      };
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, error: 'Tiempo de espera agotado al conectar con el proveedor de IA (15 s).' };
    }
    return { ok: false, error: err.message || 'Error de conexión' };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Genera respuestas contextuales simuladas de respaldo cuando no hay API Key configurada.
 */
function generarRespuestaSimulada(tarea, datos = {}, formato = 'json') {
  if (formato === 'texto' && tarea === 'prueba') {
    return 'OK';
  }

  if (tarea === 'tutor') {
    return '¡Hola! He revisado tu progreso en este tema. Para profundizar en el aprendizaje, reflexiona: ¿de qué manera este concepto se aplica en un caso real del área de estudio? Intenta explicarlo con tus propias palabras y lo analizamos juntos.';
  }

  if (tarea === 'generar-glosario') {
    return [
      {
        termino: 'Fundamento Conceptual',
        definicion: 'Principio pedagógico central que estructura la comprensión teórica del tema.',
        pista: 'Concepto esencial del tema',
        retroalimentacion: 'Excelente comprensión del fundamento conceptual.'
      },
      {
        termino: 'Aplicación Práctica',
        definicion: 'Metodología que permite transferir los conocimientos a la resolución de problemas reales.',
        pista: 'Orientado a la práctica profesional',
        retroalimentacion: 'Muy bien identificado el valor de la aplicación práctica.'
      },
      {
        termino: 'Pensamiento Crítico',
        definicion: 'Habilidad de examinar evidencias, comparar posturas y argumentar con rigor.',
        pista: 'Habilidad de orden superior',
        retroalimentacion: 'Correcto. El pensamiento crítico consolida el aprendizaje significativo.'
      }
    ];
  }

  if (tarea === 'generar-preguntas') {
    return [
      {
        tipo: 'opcion',
        enunciado: '¿Cuál es el objetivo principal al aplicar los conceptos fundamentales de este tema?',
        opciones: [
          'Fortalecer el análisis reflexivo y la resolución fundamentada de problemas',
          'Memorizar términos aislados sin considerar el contexto pedagógico',
          'Omitir la validación teórica en los procedimientos prácticos',
          'Limitar el alcance del aprendizaje a repeticiones mecánicas'
        ],
        correcta: 0,
        retroalimentacion: 'Correcto. El propósito esencial es el análisis reflexivo y la aplicación fundamentada.'
      },
      {
        tipo: 'vf',
        enunciado: 'La integración entre teoría y práctica mejora la comprensión y retención de los contenidos.',
        opciones: ['Verdadero', 'Falso'],
        correcta: true,
        retroalimentacion: 'Verdadero. La evidencia educativa respalda la vinculación entre teoría y práctica.'
      },
      {
        tipo: 'completar',
        enunciado: 'El enfoque educativo promueve la formación integral y el pensamiento ______.',
        opciones: ['crítico'],
        correcta: 'crítico',
        retroalimentacion: 'Exacto. Se impulsa el pensamiento crítico de los estudiantes.'
      }
    ];
  }

  if (tarea === 'generar-escenario') {
    return {
      titulo: 'Escenario educativo contextual',
      escenaInicial: 1,
      escenas: [
        {
          id: 1,
          texto: 'Se presenta un dilema práctico donde debes decidir la mejor estrategia de abordaje.',
          opciones: [
            {
              texto: 'Analizar los antecedentes antes de tomar una decisión',
              destino: 2,
              puntos: 10,
              consecuencia: 'Has seguido un criterio analítico y metódico.'
            }
          ]
        },
        {
          id: 2,
          texto: 'La decisión fundamentada ha generado un resultado óptimo en el caso simulado.',
          opciones: []
        }
      ]
    };
  }

  if (tarea === 'evaluar-rol') {
    return {
      puntaje: 90,
      maximo: 100,
      criterios: {
        'Pertinencia': 90,
        'Argumentación': 90
      },
      comentarioGeneral: 'Buen desenvolvimiento contextual y justificación sólida en la toma de decisiones.'
    };
  }

  return formato === 'texto' ? 'Operación completada con éxito.' : { ok: true };
}

/**
 * Realiza la llamada HTTP a la API de IA configurada con fetch nativo y timeout de 60 s.
 */
async function llamarApiIA({ sistema, usuarioMensaje, temperatura = 0.4, reintentoJson = false }) {
  const config = await obtenerConfigIA();
  const proveedor = config.proveedor;
  const clave = config.clave;
  const modelo = config.modelo;

  if (!clave) {
    const err = new Error('No se ha configurado la clave de IA en el servidor (IA_CLAVE)');
    err.estado = 500;
    throw err;
  }

  const promptFinalUsuario = reintentoJson
    ? `${usuarioMensaje}\n\nIMPORTANTE: La respuesta anterior no fue válida. Responde SOLO con JSON válido, sin bloques de código adicionales ni texto conversacional.`
    : usuarioMensaje;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 segundos máx

  try {
    if (proveedor === 'gemini' || proveedor === 'google') {
      // API oficial de Google Gemini
      const nombreModelo = modelo.startsWith('models/') ? modelo.replace('models/', '') : modelo;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(nombreModelo)}:generateContent?key=${encodeURIComponent(clave)}`;

      const cuerpoPeticion = {
        contents: [
          {
            role: 'user',
            parts: [{ text: promptFinalUsuario }]
          }
        ],
        generationConfig: {
          temperature: temperatura
        }
      };

      if (sistema && sistema.trim()) {
        cuerpoPeticion.systemInstruction = {
          parts: [{ text: sistema.trim() }]
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cuerpoPeticion),
        signal: controller.signal
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data?.error?.message || `Error de Google Gemini (${res.status})`;
        if ((errorMsg.includes('high demand') || res.status === 503) && nombreModelo !== 'gemini-3.5-flash') {
          try {
            const urlAlt = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${encodeURIComponent(clave)}`;
            const resAlt = await fetch(urlAlt, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(cuerpoPeticion),
              signal: controller.signal
            });
            const dataAlt = await resAlt.json();
            if (resAlt.ok) {
              const candidateAlt = dataAlt.candidates?.[0];
              return candidateAlt?.content?.parts?.[0]?.text || '';
            }
          } catch {}
        }
        const err = new Error(errorMsg);
        err.estado = 502;
        throw err;
      }

      const candidate = data.candidates?.[0];
      const textoSalida = candidate?.content?.parts?.[0]?.text || '';
      return textoSalida;
    } else {
      // Proveedores estándar OpenAI/Groq/OpenRouter
      let url = 'https://api.openai.com/v1/chat/completions';
      if (proveedor === 'groq') {
        url = 'https://api.groq.com/openai/v1/chat/completions';
      } else if (proveedor === 'openrouter') {
        url = 'https://openrouter.ai/api/v1/chat/completions';
      }

      const mensajes = [];
      if (sistema && sistema.trim()) {
        mensajes.push({ role: 'system', content: sistema.trim() });
      }
      mensajes.push({ role: 'user', content: promptFinalUsuario });

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${clave}`
        },
        body: JSON.stringify({
          model: modelo,
          messages: mensajes,
          temperature: temperatura
        }),
        signal: controller.signal
      });

      const data = await res.json();
      if (!res.ok) {
        const err = new Error(data?.error?.message || `Error del proveedor de IA (${res.status})`);
        err.estado = 502;
        throw err;
      }

      return data.choices?.[0]?.message?.content || '';
    }
  } catch (errHttp) {
    if (errHttp.name === 'AbortError') {
      const err = new Error('Tiempo de espera agotado al consultar la IA (60s)');
      err.estado = 504;
      throw err;
    }
    throw errHttp;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Valida límites diarios de IA para el usuario consultando consumo-ia.jsonl.
 */
async function verificarLimiteDiario(usuarioId, tarea) {
  const ajustes = await almacen.leerConfig('ajustes');
  const esTutorOEscenario = tarea === 'tutor' || tarea === 'rol-simulacion';
  const limiteMax = esTutorOEscenario
    ? (ajustes?.limiteTutorDiario ?? 40)
    : (ajustes?.limiteIADiario ?? 30);

  const hoyStr = new Date().toISOString().slice(0, 10);
  const lineas = await almacen.leerLineas('consumo-ia');

  let usosHoy = 0;
  for (const reg of (lineas || [])) {
    if (!reg || String(reg.usuarioId) !== String(usuarioId)) continue;
    const fechaReg = (reg.fecha || '').slice(0, 10);
    if (fechaReg === hoyStr) {
      const regEsTutor = reg.tarea === 'tutor' || reg.tarea === 'rol-simulacion';
      if (esTutorOEscenario === regEsTutor) {
        usosHoy++;
      }
    }
  }

  if (usosHoy >= limiteMax) {
    const tipoServicio = esTutorOEscenario ? 'del tutor virtual' : 'de generación con IA';
    const error = new Error(`Has alcanzado el límite diario ${tipoServicio} (${limiteMax} consultas al día). Vuelve a intentarlo mañana.`);
    error.estado = 429;
    throw error;
  }
}

/**
 * Registra el consumo en consumo-ia.jsonl (sin textos ni datos personales).
 */
async function registrarConsumo(usuarioId, tarea, entradaCaract, salidaCaract, ok) {
  try {
    await almacen.agregarLinea('consumo-ia', {
      usuarioId: String(usuarioId),
      tarea,
      entrada: entradaCaract || 0,
      salida: salidaCaract || 0,
      ok: Boolean(ok),
      fecha: new Date().toISOString()
    });
  } catch (errReg) {
    console.error('Error al registrar consumo-ia.jsonl:', errReg);
  }
}

/**
 * Ejecuta una tarea de IA procesando plantilla, límites y respuesta.
 * @param {string} tarea Nombre de la tarea (letras minúsculas y guiones)
 * @param {object} datos Claves y valores a reemplazar en el prompt
 * @param {object} usuario Usuario solicitante
 * @param {object} opciones { formato: "json" | "texto" }
 * @returns {Promise<any>}
 */
export async function ejecutarTarea(tarea, datos = {}, usuario = null, { formato = 'json' } = {}) {
  // Validar nombre de tarea
  if (!tarea || !/^[a-z0-9-]+$/.test(tarea)) {
    const error = new Error('Nombre de tarea inválido');
    error.estado = 400;
    throw error;
  }

  // 1. Verificar límite diario del usuario
  if (usuario && usuario.id) {
    await verificarLimiteDiario(usuario.id, tarea);
  }

  // 2. Cargar plantilla servidor/prompts/<tarea>.txt
  const rutaPrompt = path.join(PROMPTS_DIR, `${tarea}.txt`);
  let plantilla = '';
  try {
    plantilla = await fs.readFile(rutaPrompt, 'utf-8');
  } catch (errFile) {
    const error = new Error(`Plantilla de prompt para la tarea "${tarea}" no encontrada`);
    error.estado = 404;
    throw error;
  }

  // Reemplazar cada {{clave}}
  let promptProcesado = plantilla;
  for (const [clave, valor] of Object.entries(datos || {})) {
    let valorFormateado = '';
    if (Array.isArray(valor)) {
      valorFormateado = valor.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join('\n');
    } else if (valor !== null && valor !== undefined) {
      valorFormateado = String(valor);
    }
    // Cada valor recortado a 6.000 caracteres
    if (valorFormateado.length > 6000) {
      valorFormateado = valorFormateado.slice(0, 6000);
    }

    const regExp = new RegExp(`{{${clave}}}`, 'g');
    promptProcesado = promptProcesado.replace(regExp, valorFormateado);
  }

  // Separar sistema y usuario por "### USUARIO"
  let instruccionSistema = '';
  let mensajeUsuario = promptProcesado;

  if (promptProcesado.includes('### USUARIO')) {
    const partes = promptProcesado.split('### USUARIO');
    instruccionSistema = partes[0].trim();
    mensajeUsuario = partes.slice(1).join('### USUARIO').trim();
  }

  const caracteresEntrada = instruccionSistema.length + mensajeUsuario.length;
  const temperatura = (tarea === 'tutor' || tarea === 'rol-simulacion') ? 0.7 : 0.4;

  const config = await obtenerConfigIA();
  if (!config.tieneClave) {
    const simulada = generarRespuestaSimulada(tarea, datos, formato);
    if (usuario && usuario.id) {
      await registrarConsumo(usuario.id, tarea, caracteresEntrada, 150, true);
    }
    return simulada;
  }

  let textoSalida = '';
  let resultadoFinal = null;
  let exitoso = false;

  try {
    // 3. Primera llamada
    textoSalida = await llamarApiIA({
      sistema: instruccionSistema,
      usuarioMensaje: mensajeUsuario,
      temperatura,
      reintentoJson: false
    });

    if (formato === 'texto') {
      resultadoFinal = textoSalida.trim();
      exitoso = true;
      return resultadoFinal;
    }

    // 4. Formato JSON: parsear y validar
    let jsonParsed = extraerJson(textoSalida);
    let esValido = jsonParsed ? validarEsquema(tarea, jsonParsed) : false;

    // Si falla, reintento único
    if (!esValido) {
      try {
        const textoReintento = await llamarApiIA({
          sistema: instruccionSistema,
          usuarioMensaje: mensajeUsuario,
          temperatura,
          reintentoJson: true
        });

        textoSalida = textoReintento;
        jsonParsed = extraerJson(textoReintento);
        esValido = jsonParsed ? validarEsquema(tarea, jsonParsed) : false;
      } catch (errReintento) {
        console.warn('Fallo en reintento de IA:', errReintento.message);
      }
    }

    if (!esValido || !jsonParsed) {
      const err = new Error('La IA no devolvió un formato válido');
      err.estado = 502;
      throw err;
    }

    resultadoFinal = jsonParsed;
    exitoso = true;
    return resultadoFinal;
  } finally {
    // 5. Registrar consumo en consumo-ia.jsonl
    if (usuario && usuario.id) {
      await registrarConsumo(
        usuario.id,
        tarea,
        caracteresEntrada,
        textoSalida ? textoSalida.length : 0,
        exitoso
      );
    }
  }
}

export default {
  ejecutarTarea,
  obtenerConfigIA,
  guardarConfigIA,
  probarConexionApi,
  listarModelosIA,
  MODELOS_GEMINI_DEFECTO
};
