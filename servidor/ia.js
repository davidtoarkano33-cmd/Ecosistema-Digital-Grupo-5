// servidor/ia.js · Motor y servicio de invocación de IA
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as almacen from './almacen.js';
import { validarEsquema } from './esquemas-ia.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROMPTS_DIR = path.join(__dirname, 'prompts');

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
 * Realiza la llamada HTTP a la API de IA configurada con fetch nativo y timeout de 60 s.
 */
async function llamarApiIA({ sistema, usuarioMensaje, temperatura = 0.4, reintentoJson = false }) {
  const proveedor = (process.env.IA_PROVEEDOR || 'gemini').trim().toLowerCase();
  const clave = (process.env.IA_CLAVE || '').trim();
  const modelo = (process.env.IA_MODELO || 'gemini-1.5-flash').trim();

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
  ejecutarTarea
};
