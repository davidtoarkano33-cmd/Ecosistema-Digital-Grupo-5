// servidor/rutas/resumen.js · Rutas de resúmenes de progreso para estudiante y grupo
import { Router } from 'express';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

const router = Router();

// Redondear a 1 decimal
function redondear1Dec(num) {
  if (num === null || num === undefined || Number.isNaN(num)) return null;
  return Math.round(Number(num) * 10) / 10;
}

// Obtener identificador de semana "YYYY-Www" a partir de una fecha ISO
function obtenerSemanaIso(fechaIso) {
  try {
    const d = new Date(fechaIso);
    if (Number.isNaN(d.getTime())) return null;
    const target = new Date(d.valueOf());
    const dayNr = (d.getUTCDay() + 6) % 7;
    target.setUTCDate(target.getUTCDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setUTCMonth(0, 1);
    if (target.getUTCDay() !== 4) {
      target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
    }
    const weekNr = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    return `${target.getUTCFullYear()}-W${String(weekNr).padStart(2, '0')}`;
  } catch {
    return null;
  }
}

// 1. GET /resumen/estudiante/:id ("yo" permitido; acceso: el propio estudiante, un docente de sus grupos o el admin)
router.get('/resumen/estudiante/:id', async (req, res) => {
  try {
    const usuario = req.usuario;
    if (!usuario) {
      return res.status(401).json({ error: 'Sesión no iniciada' });
    }

    let estudianteId = req.params.id;
    if (estudianteId === 'yo') {
      estudianteId = usuario.id;
    }

    // Verificar permisos de acceso
    if (usuario.rol === 'admin') {
      // Admin tiene acceso total
    } else if (usuario.id === estudianteId) {
      // El propio estudiante
    } else if (usuario.rol === 'docente') {
      // Debe ser docente de alguno de los grupos del estudiante
      const estudiantesDocente = await acceso.estudiantesDe(usuario.id);
      const pertenece = (estudiantesDocente || []).some(est => est && String(est.id) === String(estudianteId));
      if (!pertenece) {
        return res.status(403).json({ error: 'No tienes permiso para ver el resumen de este estudiante' });
      }
    } else {
      return res.status(403).json({ error: 'Acceso no permitido' });
    }

    // Leer cada colección y bitacora.jsonl exactamente una sola vez
    const [
      todosUsuarios,
      todosDistributivos,
      todasUnidades,
      todosTemas,
      todosIntentos,
      todosLogros,
      todosProgresoTemas,
      todasLineasBitacora
    ] = await Promise.all([
      almacen.leer('usuarios'),
      almacen.leer('distributivo'),
      almacen.leer('unidades'),
      almacen.leer('temas'),
      almacen.leer('intentos'),
      almacen.leer('logros'),
      almacen.leer('progreso-temas'),
      almacen.leerLineas('bitacora')
    ]);

    const estudiante = (todosUsuarios || []).find(u => u && String(u.id) === String(estudianteId));
    if (!estudiante) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    // 1. Puntos y nivelQuizMax a partir de logros
    const logro = (todosLogros || []).find(l => l && String(l.usuarioId) === String(estudianteId));
    const puntos = (logro && typeof logro.puntos === 'number') ? logro.puntos : 0;
    const nivelesQuiz = (logro && logro.nivelQuiz) ? Object.values(logro.nivelQuiz).map(Number).filter(n => !Number.isNaN(n)) : [];
    const nivelQuizMax = nivelesQuiz.length > 0 ? Math.max(...nivelesQuiz) : 0;

    // 2. Asignaturas y temas publicados asociados al estudiante
    const gruposEstudiante = (todosDistributivos || []).filter(g =>
      g && Array.isArray(g.estudiantes) && g.estudiantes.some(eId => String(eId) === String(estudianteId))
    );
    const asignaturasIds = new Set(gruposEstudiante.map(g => g.asignaturaId).filter(Boolean));

    const unidadesValidas = (todasUnidades || []).filter(u =>
      u && asignaturasIds.has(u.asignaturaId) && u.visible !== false
    );
    const unidadesIds = new Set(unidadesValidas.map(u => u.id));

    // Temas publicados pertenecientes a las asignaturas del estudiante
    const temasPublicadosEstudiante = (todosTemas || []).filter(t =>
      t && unidadesIds.has(t.unidadId) && t.estado === 'publicado'
    );
    const mapaTemas = new Map((todosTemas || []).map(t => [t.id, t]));

    // Temas revisados por el estudiante
    const progresoEstudiante = (todosProgresoTemas || []).filter(p =>
      p && String(p.usuarioId) === String(estudianteId)
    );
    const temasRevisadosIds = new Set(progresoEstudiante.map(p => p.temaId));

    const totalPublicados = temasPublicadosEstudiante.length;
    const revisadosCount = temasPublicadosEstudiante.filter(t => temasRevisadosIds.has(t.id)).length;
    const pctTemas = totalPublicados > 0 ? Math.round((revisadosCount / totalPublicados) * 100) : 0;

    // Temas pendientes (publicados sin revisar)
    const pendientes = temasPublicadosEstudiante
      .filter(t => !temasRevisadosIds.has(t.id))
      .map(t => ({ temaId: t.id, titulo: t.titulo || 'Sin título' }));

    // 3. Intentos del estudiante (excluyendo "tema-revisado" para promedios de calificación)
    const intentosEstudiante = (todosIntentos || [])
      .filter(i => i && String(i.usuarioId) === String(estudianteId))
      .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

    // Últimos 20 intentos en orden cronológico descendente
    const ultimosIntentos = intentosEstudiante.slice(0, 20);

    // Intentos evaluables (sin contar "tema-revisado")
    const intentosCalificables = intentosEstudiante.filter(i =>
      i.actividad !== 'tema-revisado' &&
      typeof i.puntaje === 'number' &&
      typeof i.maximo === 'number' &&
      i.maximo > 0
    );

    // Promedio general
    let promedio = null;
    if (intentosCalificables.length > 0) {
      const sumaNotas = intentosCalificables.reduce((acc, curr) => acc + ((curr.puntaje / curr.maximo) * 10), 0);
      promedio = redondear1Dec(sumaNotas / intentosCalificables.length);
    }

    // Por actividad
    const actMap = new Map();
    for (const intento of intentosCalificables) {
      const act = intento.actividad || 'general';
      if (!actMap.has(act)) {
        actMap.set(act, { actividad: act, suma: 0, intentos: 0 });
      }
      const item = actMap.get(act);
      item.suma += (intento.puntaje / intento.maximo) * 10;
      item.intentos++;
    }
    const porActividad = Array.from(actMap.values()).map(a => ({
      actividad: a.actividad,
      promedio: redondear1Dec(a.suma / a.intentos),
      intentos: a.intentos
    }));

    // Por tema
    const temaMap = new Map();
    for (const intento of intentosCalificables) {
      if (!intento.temaId) continue;
      if (!temaMap.has(intento.temaId)) {
        const tema = mapaTemas.get(intento.temaId);
        temaMap.set(intento.temaId, {
          temaId: intento.temaId,
          titulo: tema ? tema.titulo : 'Tema general',
          suma: 0,
          intentos: 0
        });
      }
      const item = temaMap.get(intento.temaId);
      item.suma += (intento.puntaje / intento.maximo) * 10;
      item.intentos++;
    }
    const porTema = Array.from(temaMap.values()).map(t => ({
      temaId: t.temaId,
      titulo: t.titulo,
      promedio: redondear1Dec(t.suma / t.intentos),
      intentos: t.intentos
    }));

    // Evolución: últimas 8 semanas con datos (orden cronológico ascendente)
    const semanaMap = new Map();
    for (const intento of intentosCalificables) {
      if (!intento.fecha) continue;
      const sem = obtenerSemanaIso(intento.fecha);
      if (!sem) continue;
      if (!semanaMap.has(sem)) {
        semanaMap.set(sem, { semana: sem, suma: 0, intentos: 0 });
      }
      const item = semanaMap.get(sem);
      item.suma += (intento.puntaje / intento.maximo) * 10;
      item.intentos++;
    }
    const todasSemanas = Array.from(semanaMap.values())
      .map(s => ({
        semana: s.semana,
        promedio: redondear1Dec(s.suma / s.intentos)
      }))
      .sort((a, b) => a.semana.localeCompare(b.semana));
    const evolucion = todasSemanas.slice(-8);

    // 4. Última conexión y tiempo total invertido
    const eventosUsuario = (todasLineasBitacora || []).filter(e => e && String(e.usuarioId) === String(estudianteId));
    let ultimaConexion = null;
    if (eventosUsuario.length > 0) {
      const eventosOrdenados = [...eventosUsuario].sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
      ultimaConexion = eventosOrdenados[0].fecha || null;
    }

    // Tiempo en minutos acumulado en intentos
    const duracionSegTotal = intentosEstudiante.reduce((acc, curr) => acc + (Number(curr.duracionSeg) || 0), 0);
    const tiempoMin = Math.round(duracionSegTotal / 60);

    return res.json({
      puntos,
      nivelQuizMax,
      pctTemas,
      promedio,
      porActividad,
      porTema,
      evolucion,
      pendientes,
      ultimaConexion,
      tiempoMin,
      ultimosIntentos
    });
  } catch (err) {
    console.error('Error en GET /resumen/estudiante/:id:', err);
    return res.status(err.estado || 500).json({ error: err.message || 'Error interno del servidor' });
  }
});

// 2. GET /resumen/grupo/:grupoId (docente del grupo o admin)
router.get('/resumen/grupo/:grupoId', async (req, res) => {
  try {
    const usuario = req.usuario;
    if (!usuario) {
      return res.status(401).json({ error: 'Sesión no iniciada' });
    }

    const { grupoId } = req.params;

    // Evaluar alertas de inactividad del grupo antes de calcular resumen
    try {
      const { evaluarInactividad } = await import('../alertas.js');
      await evaluarInactividad(grupoId);
    } catch (errInact) {
      console.error('Error al evaluar inactividad en resumen:', errInact);
    }

    // Leer cada colección y bitacora.jsonl exactamente una sola vez
    const [
      todosDistributivos,
      todosUsuarios,
      todasUnidades,
      todosTemas,
      todosIntentos,
      todosProgresoTemas,
      todasAlertas,
      todasLineasBitacora
    ] = await Promise.all([
      almacen.leer('distributivo'),
      almacen.leer('usuarios'),
      almacen.leer('unidades'),
      almacen.leer('temas'),
      almacen.leer('intentos'),
      almacen.leer('progreso-temas'),
      almacen.leer('alertas'),
      almacen.leerLineas('bitacora')
    ]);

    const grupo = (todosDistributivos || []).find(g => g && String(g.id) === String(grupoId));
    if (!grupo) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }

    // Validar permisos: docente del grupo o admin
    if (usuario.rol !== 'admin' && String(grupo.docenteId) !== String(usuario.id)) {
      return res.status(403).json({ error: 'Solo el docente del grupo o el administrador pueden ver este resumen' });
    }

    const estudiantesIds = Array.isArray(grupo.estudiantes) ? grupo.estudiantes.map(String) : [];
    const estudiantesIdsSet = new Set(estudiantesIds);

    // Temas publicados de la asignatura del grupo
    const unidadesGrupo = (todasUnidades || []).filter(u =>
      u && String(u.asignaturaId) === String(grupo.asignaturaId) && u.visible !== false
    );
    const unidadesIdsSet = new Set(unidadesGrupo.map(u => u.id));
    const temasPublicadosGrupo = (todosTemas || []).filter(t =>
      t && unidadesIdsSet.has(t.unidadId) && t.estado === 'publicado'
    );
    const totalTemasPublicados = temasPublicadosGrupo.length;
    const mapaTemas = new Map((todosTemas || []).map(t => [t.id, t]));

    // Pre-procesar bitácora por usuario para obtener última conexión rápidamente
    const ultimaConexionPorUsuario = new Map();
    for (const linea of (todasLineasBitacora || [])) {
      if (!linea || !linea.usuarioId || !linea.fecha) continue;
      const uId = String(linea.usuarioId);
      if (!estudiantesIdsSet.has(uId)) continue;
      const fActual = ultimaConexionPorUsuario.get(uId);
      if (!fActual || new Date(linea.fecha) > new Date(fActual)) {
        ultimaConexionPorUsuario.set(uId, linea.fecha);
      }
    }

    // Pre-procesar alertas activas por estudiante en este grupo
    const alertasActivasPorEstudiante = new Map();
    for (const al of (todasAlertas || [])) {
      if (!al || !al.estudianteId) continue;
      if (al.estado === 'activa' && String(al.grupoId) === String(grupoId)) {
        const estId = String(al.estudianteId);
        alertasActivasPorEstudiante.set(estId, (alertasActivasPorEstudiante.get(estId) || 0) + 1);
      }
    }

    // Pre-procesar progreso de temas por estudiante para este grupo
    const temasRevisadosPorEstudiante = new Map();
    for (const p of (todosProgresoTemas || [])) {
      if (!p || !p.usuarioId || !p.temaId) continue;
      const estId = String(p.usuarioId);
      if (!estudiantesIdsSet.has(estId)) continue;
      // Solo contar si es un tema publicado del grupo
      if (temasPublicadosGrupo.some(t => t.id === p.temaId)) {
        if (!temasRevisadosPorEstudiante.has(estId)) {
          temasRevisadosPorEstudiante.set(estId, new Set());
        }
        temasRevisadosPorEstudiante.get(estId).add(p.temaId);
      }
    }

    // Pre-procesar intentos por estudiante y por tema
    const intentosPorEstudiante = new Map();
    const intentosCalificablesGrupo = [];

    for (const intento of (todosIntentos || [])) {
      if (!intento || !intento.usuarioId) continue;
      const estId = String(intento.usuarioId);
      if (!estudiantesIdsSet.has(estId)) continue;

      if (!intentosPorEstudiante.has(estId)) {
        intentosPorEstudiante.set(estId, []);
      }
      intentosPorEstudiante.get(estId).push(intento);

      // Si pertenece a un tema del grupo o fue realizado por un estudiante del grupo
      if (
        intento.actividad !== 'tema-revisado' &&
        typeof intento.puntaje === 'number' &&
        typeof intento.maximo === 'number' &&
        intento.maximo > 0
      ) {
        // Filtrar intentos que correspondan a temas de la asignatura del grupo si tienen temaId
        if (!intento.temaId || temasPublicadosGrupo.some(t => t.id === intento.temaId)) {
          intentosCalificablesGrupo.push(intento);
        }
      }
    }

    // Construir lista de estudiantes
    const mapaUsuarios = new Map((todosUsuarios || []).map(u => [String(u.id), u]));

    const estudiantes = estudiantesIds.map(estId => {
      const u = mapaUsuarios.get(estId) || { id: estId, nombre: 'Estudiante', apellido: '' };
      const susIntentos = intentosPorEstudiante.get(estId) || [];
      const calificables = susIntentos.filter(i =>
        i.actividad !== 'tema-revisado' &&
        typeof i.puntaje === 'number' &&
        typeof i.maximo === 'number' &&
        i.maximo > 0
      );

      let prom = null;
      if (calificables.length > 0) {
        const suma = calificables.reduce((acc, curr) => acc + ((curr.puntaje / curr.maximo) * 10), 0);
        prom = redondear1Dec(suma / calificables.length);
      }

      // Cantidad de actividades evaluables realizadas
      const actividades = calificables.length;

      // Porcentaje de temas revisados
      const revisados = temasRevisadosPorEstudiante.get(estId)?.size || 0;
      const pctTemas = totalTemasPublicados > 0 ? Math.round((revisados / totalTemasPublicados) * 100) : 0;

      const ultimaConexion = ultimaConexionPorUsuario.get(estId) || null;
      const alertasActivas = alertasActivasPorEstudiante.get(estId) || 0;

      return {
        id: u.id,
        nombre: u.nombre,
        apellido: u.apellido,
        promedio: prom,
        actividades,
        pctTemas,
        ultimaConexion,
        alertasActivas
      };
    });

    // Por tema a nivel de grupo
    const temaStatsMap = new Map();
    for (const intento of intentosCalificablesGrupo) {
      if (!intento.temaId) continue;
      if (!temaStatsMap.has(intento.temaId)) {
        const tema = mapaTemas.get(intento.temaId);
        temaStatsMap.set(intento.temaId, {
          temaId: intento.temaId,
          titulo: tema ? tema.titulo : 'Tema general',
          suma: 0,
          intentos: 0
        });
      }
      const item = temaStatsMap.get(intento.temaId);
      item.suma += (intento.puntaje / intento.maximo) * 10;
      item.intentos++;
    }

    const porTema = Array.from(temaStatsMap.values()).map(t => ({
      temaId: t.temaId,
      titulo: t.titulo,
      promedio: redondear1Dec(t.suma / t.intentos),
      intentos: t.intentos
    }));

    return res.json({
      grupo: {
        id: grupo.id,
        asignaturaId: grupo.asignaturaId,
        paralelo: grupo.paralelo,
        periodo: grupo.periodo,
        docenteId: grupo.docenteId
      },
      estudiantes,
      porTema
    });
  } catch (err) {
    console.error('Error en GET /resumen/grupo/:grupoId:', err);
    return res.status(err.estado || 500).json({ error: err.message || 'Error interno del servidor' });
  }
});

export default router;
