// servidor/gamificacion.js · Motor de puntos, intentos e insignias
import * as almacen from './almacen.js';
import * as acceso from './acceso.js';
import { evaluarAlertas } from './alertas.js';

// Control en memoria de intentos por hora por usuario (usuarioId -> Array<timestampMs>)
const intentosHoraMemoria = new Map();

function obtenerValorPorRuta(obj, ruta) {
  if (!obj || !ruta) return undefined;
  const partes = String(ruta).split('.');
  let actual = obj;
  for (const parte of partes) {
    if (actual === null || actual === undefined) return undefined;
    actual = actual[parte];
  }
  return actual;
}

function calcularRachaDias(todosIntentos) {
  const fechasUnicas = new Set(
    todosIntentos
      .map(i => (i && i.fecha ? String(i.fecha).slice(0, 10) : ''))
      .filter(Boolean)
  );

  let racha = 0;
  const cursor = new Date();

  while (true) {
    const diaIso = cursor.toISOString().slice(0, 10);
    if (fechasUnicas.has(diaIso)) {
      racha++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else {
      break;
    }
  }

  return racha;
}

export async function procesarIntento(usuario, datos) {
  if (!usuario || !usuario.id) {
    const err = new Error('Sesión requerida para registrar intentos');
    err.estado = 401;
    throw err;
  }

  if (!datos || typeof datos !== 'object') {
    const err = new Error('Datos del intento no proporcionados');
    err.estado = 400;
    throw err;
  }

  const {
    actividad,
    temaId = null,
    nivel = null,
    puntaje,
    maximo,
    errores = null,
    duracionSeg = 0,
    detalle = {}
  } = datos;

  const reglas = await almacen.leerConfig('reglas-gamificacion');
  const puntosConfig = reglas.puntos || {};

  // 1. Validar actividad existente en reglas.puntos
  if (!actividad || puntosConfig[actividad] === undefined) {
    const err = new Error(`Actividad no válida o no configurada: "${actividad}"`);
    err.estado = 400;
    throw err;
  }

  // 2. Validar 0 ≤ puntaje ≤ maximo y maximo > 0
  if (
    typeof puntaje !== 'number' ||
    typeof maximo !== 'number' ||
    maximo <= 0 ||
    puntaje < 0 ||
    puntaje > maximo
  ) {
    const err = new Error('Puntaje o máximo inválidos: se requiere 0 <= puntaje <= maximo y maximo > 0');
    err.estado = 400;
    throw err;
  }

  // 3. Si viene temaId, validar que el usuario tenga acceso (acceso.js)
  if (temaId) {
    const asignaturaId = await acceso.asignaturaDeTema(temaId);
    if (!asignaturaId) {
      const err = new Error('El tema indicado no existe o no tiene asignatura vinculada');
      err.estado = 404;
      throw err;
    }

    const misAsignaturas = await acceso.asignaturasDe(usuario);
    const tieneAcceso = misAsignaturas.some(a => a && a.id === asignaturaId);
    if (!tieneAcceso) {
      const err = new Error('No tienes acceso a los contenidos de este tema');
      err.estado = 403;
      throw err;
    }
  }

  // 4. Rate limiting: máximo reglas.limiteIntentosHora intentos por hora en memoria -> 429
  const limiteHora = reglas.limiteIntentosHora || 60;
  const ahoraMs = Date.now();
  const unaHoraAtras = ahoraMs - 60 * 60 * 1000;
  const uid = String(usuario.id);

  let intentosUsuario = (intentosHoraMemoria.get(uid) || []).filter(t => t > unaHoraAtras);
  if (intentosUsuario.length >= limiteHora) {
    const err = new Error('Límite de intentos por hora superado');
    err.estado = 429;
    throw err;
  }
  intentosUsuario.push(ahoraMs);
  intentosHoraMemoria.set(uid, intentosUsuario);

  // 5. Cálculo base de puntos: redondeo(reglas.puntos[actividad] × puntaje / maximo) + bonoSinErrores
  const puntosBase = Math.round((puntosConfig[actividad] * puntaje) / maximo);
  const tieneBono = errores === 0 && puntaje === maximo;
  const bono = tieneBono ? (reglas.bonoSinErrores || 0) : 0;
  let puntosGanados = puntosBase + bono;

  // 6. Condiciones para guardar sin puntos (puntos = 0)
  const intentosPrevios = await almacen.buscar('intentos', { usuarioId: usuario.id });

  // 6.1 Actividad única: ya existe intento con puntos con la misma clave
  if (puntosGanados > 0 && reglas.unicas && reglas.unicas[actividad]) {
    const camposClave = reglas.unicas[actividad];
    const intentoActualParaClave = {
      actividad,
      temaId,
      nivel,
      puntaje,
      maximo,
      errores,
      duracionSeg,
      detalle: detalle || {}
    };

    const valorClaveActual = camposClave
      .map(c => String(obtenerValorPorRuta(intentoActualParaClave, c)))
      .join('::');

    const yaGanado = intentosPrevios.some(prev => {
      if (prev.actividad !== actividad || !prev.puntos || prev.puntos <= 0) return false;
      const valorClavePrev = camposClave
        .map(c => String(obtenerValorPorRuta(prev, c)))
        .join('::');
      return valorClavePrev === valorClaveActual;
    });

    if (yaGanado) {
      puntosGanados = 0;
    }
  }

  // 6.2 Requiere aprobado y detalle.aprobado !== true
  if (
    puntosGanados > 0 &&
    Array.isArray(reglas.requiereAprobado) &&
    reglas.requiereAprobado.includes(actividad)
  ) {
    if (!detalle || detalle.aprobado !== true) {
      puntosGanados = 0;
    }
  }

  // 6.3 Tope diario por actividad (intentos con puntos en la fecha de hoy)
  if (
    puntosGanados > 0 &&
    reglas.maxDiario &&
    reglas.maxDiario[actividad] !== undefined
  ) {
    const maximoDiario = reglas.maxDiario[actividad];
    const hoyStr = new Date().toISOString().slice(0, 10);
    const conteoHoy = intentosPrevios.filter(prev => {
      if (prev.actividad !== actividad || !prev.puntos || prev.puntos <= 0) return false;
      const fechaPrev = prev.fecha ? String(prev.fecha).slice(0, 10) : '';
      return fechaPrev === hoyStr;
    }).length;

    if (conteoHoy >= maximoDiario) {
      puntosGanados = 0;
    }
  }

  // 7. Guardar el intento (con sus puntos calculados)
  const intentoGuardado = await almacen.agregar('intentos', {
    usuarioId: usuario.id,
    actividad,
    temaId,
    nivel: nivel !== undefined ? nivel : null,
    puntaje,
    maximo,
    errores: errores !== undefined ? errores : null,
    duracionSeg: duracionSeg || 0,
    detalle: detalle || {},
    puntos: puntosGanados
  });

  // 8. Cargar o crear logros del usuario
  const listaLogros = await almacen.buscar('logros', { usuarioId: usuario.id });
  let logro = listaLogros[0];
  if (!logro) {
    logro = {
      usuarioId: usuario.id,
      puntos: 0,
      insignias: [],
      nivelQuiz: {}
    };
  } else {
    if (typeof logro.puntos !== 'number') logro.puntos = 0;
    if (!Array.isArray(logro.insignias)) logro.insignias = [];
    if (!logro.nivelQuiz || typeof logro.nivelQuiz !== 'object') logro.nivelQuiz = {};
  }

  // Acumular puntos
  logro.puntos += puntosGanados;

  // Actualizar nivelQuiz si corresponde
  if (actividad === 'quiz' && detalle && detalle.aprobado === true && nivel !== null && nivel !== undefined) {
    const claveTema = temaId || 'general';
    const nivelNumerico = Number(nivel);
    logro.nivelQuiz[claveTema] = Math.max(logro.nivelQuiz[claveTema] || 0, nivelNumerico);
  }

  // 9. Evaluar insignias no obtenidas
  const catalogoInsignias = await almacen.leer('insignias');
  const insigniasObtenidasIds = new Set(logro.insignias.map(i => i && i.id));
  const todosIntentos = [...intentosPrevios, intentoGuardado];
  const insigniasNuevas = [];

  for (const ins of catalogoInsignias) {
    if (!ins || !ins.id || insigniasObtenidasIds.has(ins.id)) continue;
    const cond = ins.condicion;
    if (!cond || !cond.tipo) continue;

    let cumple = false;

    switch (cond.tipo) {
      case 'conteo': {
        const act = cond.actividad;
        const minimo = cond.minimo || 1;
        const intentosDeAct = todosIntentos.filter(i => i && i.actividad === act);
        const camposUnicos = reglas.unicas ? reglas.unicas[act] : null;

        if (camposUnicos && Array.isArray(camposUnicos)) {
          // En actividades únicas, contar claves distintas
          const clavesDistintas = new Set();
          for (const i of intentosDeAct) {
            const claveStr = camposUnicos
              .map(c => String(obtenerValorPorRuta(i, c)))
              .join('::');
            clavesDistintas.add(claveStr);
          }
          cumple = clavesDistintas.size >= minimo;
        } else {
          cumple = intentosDeAct.length >= minimo;
        }
        break;
      }

      case 'sinErrores': {
        const act = cond.actividad;
        cumple = todosIntentos.some(
          i => i && i.actividad === act && i.errores === 0 && i.puntaje === i.maximo
        );
        break;
      }

      case 'puntos': {
        const minimoPuntos = cond.minimo || 0;
        cumple = logro.puntos >= minimoPuntos;
        break;
      }

      case 'nivelQuiz': {
        const nivelReq = cond.nivel || 1;
        cumple = Object.values(logro.nivelQuiz || {}).some(lvl => Number(lvl) >= nivelReq);
        break;
      }

      case 'racha': {
        const diasReq = cond.dias || 1;
        const rachaDias = calcularRachaDias(todosIntentos);
        cumple = rachaDias >= diasReq;
        break;
      }

      default:
        cumple = false;
    }

    if (cumple) {
      const fechaNow = new Date().toISOString();
      logro.insignias.push({ id: ins.id, fecha: fechaNow });
      insigniasNuevas.push({
        id: ins.id,
        nombre: ins.nombre,
        icono: ins.icono,
        descripcion: ins.descripcion
      });
    }
  }

  // 10. Persistir logros
  if (logro.id) {
    await almacen.actualizar('logros', logro.id, {
      puntos: logro.puntos,
      insignias: logro.insignias,
      nivelQuiz: logro.nivelQuiz
    });
  } else {
    const creado = await almacen.agregar('logros', logro);
    logro.id = creado.id;
  }

  // 11. Evaluar alertas dentro de try/catch
  try {
    await evaluarAlertas(intentoGuardado, usuario);
  } catch (errAlerta) {
    console.error('Error al evaluar alertas:', errAlerta);
  }

  return {
    puntosGanados,
    puntosTotales: logro.puntos,
    insigniasNuevas
  };
}

export default {
  procesarIntento
};
