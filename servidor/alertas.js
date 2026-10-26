// servidor/alertas.js · Evaluación de alertas de rendimiento e inactividad
import * as almacen from './almacen.js';
import { notificar } from './notificar.js';

/**
 * Evalúa reglas de alerta sobre un intento completado ("promedioBajo", "fallosQuiz").
 * @param {object} intento Intento registrado
 * @param {object} usuario Usuario estudiante
 */
export async function evaluarAlertas(intento, usuario) {
  if (!intento || !usuario || usuario.rol !== 'estudiante') {
    return;
  }

  // 1. Cargar reglas de alertas
  const reglas = await almacen.leerConfig('reglas-alertas');
  if (!reglas) return;

  const estudianteId = String(usuario.id);

  // 2. Determinar grupo del estudiante relacionado con el intento
  const todosDistributivos = await almacen.leer('distributivo');
  let grupo = null;

  if (intento.temaId) {
    const todosTemas = await almacen.leer('temas');
    const todasUnidades = await almacen.leer('unidades');
    const tema = (todosTemas || []).find(t => t && String(t.id) === String(intento.temaId));
    const unidad = tema ? (todasUnidades || []).find(u => u && String(u.id) === String(tema.unidadId)) : null;
    const asignaturaId = unidad ? String(unidad.asignaturaId) : null;

    if (asignaturaId) {
      grupo = (todosDistributivos || []).find(g =>
        g &&
        String(g.asignaturaId) === asignaturaId &&
        Array.isArray(g.estudiantes) &&
        g.estudiantes.some(id => String(id) === estudianteId)
      );
    }
  }

  // Si no se ubicó por asignatura de tema, buscar el primer grupo donde esté matriculado
  if (!grupo) {
    grupo = (todosDistributivos || []).find(g =>
      g && Array.isArray(g.estudiantes) && g.estudiantes.some(id => String(id) === estudianteId)
    );
  }

  if (!grupo) {
    return; // Sin grupo asignado
  }

  const grupoId = String(grupo.id);
  const docenteId = grupo.docenteId ? String(grupo.docenteId) : null;

  // 3. Regla erroresActividad: varios errores dentro de un intento terminado.
  if (reglas.erroresActividad && reglas.erroresActividad.activa !== false && intento.actividad !== 'tema-revisado') {
    const minimoErrores = typeof reglas.erroresActividad.minimo === 'number' ? reglas.erroresActividad.minimo : 3;
    const cantidadErrores = Number(intento.errores) || 0;
    if (cantidadErrores >= minimoErrores) {
      await crearAlertaSiNoExiste({
        estudianteId,
        docenteId,
        grupoId,
        regla: 'erroresActividad',
        temaId: intento.temaId || null,
        detalle: `${cantidadErrores} errores en la actividad ${intento.actividad || 'formativa'} (umbral: ${minimoErrores}).`,
        nombreEstudiante: `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim()
      });
    }
  }

  // 4. Regla promedioBajo: promedio de los últimos N intentos del estudiante menor que el umbral (sin "tema-revisado")
  if (reglas.promedioBajo && reglas.promedioBajo.activa !== false) {
    const umbral = typeof reglas.promedioBajo.umbral === 'number' ? reglas.promedioBajo.umbral : 7;
    const ultimosN = typeof reglas.promedioBajo.ultimos === 'number' ? reglas.promedioBajo.ultimos : 3;

    const todosIntentos = await almacen.leer('intentos');
    const intentosEstudiante = (todosIntentos || [])
      .filter(i => i && String(i.usuarioId) === estudianteId && i.actividad !== 'tema-revisado' && typeof i.puntaje === 'number' && i.maximo > 0)
      .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

    if (intentosEstudiante.length >= ultimosN) {
      const muestra = intentosEstudiante.slice(0, ultimosN);
      const sumaNotas = muestra.reduce((acc, curr) => acc + (curr.puntaje / curr.maximo) * 10, 0);
      const promedio = Math.round((sumaNotas / ultimosN) * 10) / 10;

      if (promedio < umbral) {
        await crearAlertaSiNoExiste({
          estudianteId,
          docenteId,
          grupoId,
          regla: 'promedioBajo',
          temaId: intento.temaId || null,
          detalle: `Promedio de ${promedio}/10 en los últimos ${ultimosN} intentos (umbral mínimo: ${umbral}/10).`,
          nombreEstudiante: `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim()
        });
      }
    }
  }

  // 5. Regla fallosQuiz: N intentos de quiz seguidos no aprobados en el mismo tema y nivel
  if (reglas.fallosQuiz && reglas.fallosQuiz.activa !== false && intento.actividad === 'quiz' && intento.temaId) {
    const vecesRequeridas = typeof reglas.fallosQuiz.veces === 'number' ? reglas.fallosQuiz.veces : 3;
    const nivelActual = intento.nivel !== undefined ? intento.nivel : null;

    const todosIntentos = await almacen.leer('intentos');
    const intentosQuiz = (todosIntentos || [])
      .filter(i =>
        i &&
        String(i.usuarioId) === estudianteId &&
        i.actividad === 'quiz' &&
        String(i.temaId) === String(intento.temaId) &&
        (nivelActual === null || i.nivel === nivelActual) &&
        typeof i.puntaje === 'number' &&
        i.maximo > 0
      )
      .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

    if (intentosQuiz.length >= vecesRequeridas) {
      const muestraQuiz = intentosQuiz.slice(0, vecesRequeridas);
      // No aprobado significa puntaje / maximo < 0.7 (umbral estándar de aprobación)
      const todosReprobados = muestraQuiz.every(i => (i.puntaje / i.maximo) < 0.7);

      if (todosReprobados) {
        await crearAlertaSiNoExiste({
          estudianteId,
          docenteId,
          grupoId,
          regla: 'fallosQuiz',
          temaId: String(intento.temaId),
          detalle: `${vecesRequeridas} intentos continuos de quiz no aprobados en este tema${nivelActual ? ` (Nivel ${nivelActual})` : ''}.`,
          nombreEstudiante: `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim()
        });
      }
    }
  }
}

/**
 * Evalúa inactividad de estudiantes en un grupo ("inactividad").
 * @param {string} grupoId ID del grupo
 */
export async function evaluarInactividad(grupoId) {
  if (!grupoId) return;

  const reglas = await almacen.leerConfig('reglas-alertas');
  if (!reglas || !reglas.inactividad || reglas.inactividad.activa === false) {
    return;
  }

  const diasLimite = typeof reglas.inactividad.dias === 'number' ? reglas.inactividad.dias : 7;
  const msLimite = diasLimite * 24 * 60 * 60 * 1000;
  const ahora = Date.now();

  const todosDistributivos = await almacen.leer('distributivo');
  const grupo = (todosDistributivos || []).find(g => g && String(g.id) === String(grupoId));
  if (!grupo || !Array.isArray(grupo.estudiantes) || grupo.estudiantes.length === 0) {
    return;
  }

  const docenteId = grupo.docenteId ? String(grupo.docenteId) : null;
  const estudiantesIds = grupo.estudiantes.map(String);
  const estudiantesSet = new Set(estudiantesIds);

  const [todosUsuarios, lineasBitacora] = await Promise.all([
    almacen.leer('usuarios'),
    almacen.leerLineas('bitacora')
  ]);

  const mapaUsuarios = new Map((todosUsuarios || []).map(u => [String(u.id), u]));

  // Última fecha de evento por estudiante
  const ultimaFechaPorEstudiante = new Map();
  for (const ev of (lineasBitacora || [])) {
    if (!ev || !ev.usuarioId) continue;
    const uid = String(ev.usuarioId);
    if (!estudiantesSet.has(uid)) continue;
    const tiempo = new Date(ev.fecha || 0).getTime();
    const actual = ultimaFechaPorEstudiante.get(uid) || 0;
    if (tiempo > actual) {
      ultimaFechaPorEstudiante.set(uid, tiempo);
    }
  }

  for (const estId of estudiantesIds) {
    const ultimoTiempo = ultimaFechaPorEstudiante.get(estId);
    let diasSinActividad = 0;

    if (!ultimoTiempo) {
      diasSinActividad = diasLimite; // Sin registros en bitácora
    } else {
      const diffMs = ahora - ultimoTiempo;
      if (diffMs >= msLimite) {
        diasSinActividad = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      }
    }

    if (diasSinActividad >= diasLimite) {
      const u = mapaUsuarios.get(estId);
      const nombreEstudiante = u ? `${u.nombre || ''} ${u.apellido || ''}`.trim() : 'Estudiante';

      await crearAlertaSiNoExiste({
        estudianteId: estId,
        docenteId,
        grupoId: String(grupo.id),
        regla: 'inactividad',
        temaId: null,
        detalle: `Sin actividad registrada en la plataforma durante ${diasSinActividad} días (límite: ${diasLimite} días).`,
        nombreEstudiante
      });
    }
  }
}

/**
 * Crea o actualiza una alerta activa sin duplicarla en el panel.
 * Cada nueva detección vuelve a notificar al docente.
 */
async function crearAlertaSiNoExiste({ estudianteId, docenteId, grupoId, regla, temaId = null, detalle, nombreEstudiante }) {
  const todasAlertas = await almacen.leer('alertas');

  const existente = (todasAlertas || []).find(a =>
    a &&
    String(a.estudianteId) === String(estudianteId) &&
    a.regla === regla &&
    a.estado === 'activa' &&
    (temaId ? String(a.temaId) === String(temaId) : true)
  );

  const ahora = new Date().toISOString();
  let guardada;
  if (existente) {
    guardada = await almacen.actualizar('alertas', existente.id, {
      docenteId: docenteId ? String(docenteId) : null,
      grupoId: String(grupoId),
      detalle: String(detalle || ''),
      fecha: ahora,
      reiteraciones: (Number(existente.reiteraciones) || 1) + 1
    });
  } else {
    guardada = await almacen.agregar('alertas', {
      estudianteId: String(estudianteId),
      docenteId: docenteId ? String(docenteId) : null,
      grupoId: String(grupoId),
      regla,
      temaId: temaId ? String(temaId) : null,
      detalle: String(detalle || ''),
      estado: 'activa',
      reiteraciones: 1
    });
  }

  // Notificar al docente del grupo con enlace al panel
  const mensajeNotif = `Alerta de apoyo para ${nombreEstudiante || 'un estudiante'}: ${detalle}`;
  const enlacePanel = `/paginas/panel-docente.html?grupoId=${encodeURIComponent(grupoId)}`;

  if (docenteId) {
    try {
      await notificar(docenteId, {
        tipo: 'alerta-docente',
        mensaje: mensajeNotif,
        enlace: enlacePanel
      });
    } catch (errNotif) {
      console.error('Error al notificar docente de alerta:', errNotif);
    }
  }

  // Notificar a los administradores si ajustes.alertasAdmin es true
  try {
    const ajustes = await almacen.leerConfig('ajustes');
    if (ajustes && ajustes.alertasAdmin) {
      const todosUsuarios = await almacen.leer('usuarios');
      const admins = (todosUsuarios || []).filter(u => u && u.rol === 'admin' && u.activo !== false);

      for (const adm of admins) {
        if (adm.id && String(adm.id) !== String(docenteId)) {
          await notificar(adm.id, {
            tipo: 'alerta-admin',
            mensaje: `[Admin] ${mensajeNotif}`,
            enlace: enlacePanel
          });
        }
      }
    }
  } catch (errAdminNotif) {
    console.error('Error al notificar admin de alerta:', errAdminNotif);
  }

  return guardada;
}

export default {
  evaluarAlertas,
  evaluarInactividad
};
