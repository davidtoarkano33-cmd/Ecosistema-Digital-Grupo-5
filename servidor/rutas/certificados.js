// servidor/rutas/certificados.js · Rutas de certificados de cumplimiento y niveles de quiz
import { Router } from 'express';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

const router = Router();

function generarCodigoCertificado(existentes) {
  const anio = new Date().getFullYear();
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codigosSet = new Set((existentes || []).map(c => c && c.codigo));
  let codigo = '';
  let intentos = 0;

  do {
    let aleatorio = '';
    for (let i = 0; i < 6; i++) {
      aleatorio += caracteres[Math.floor(Math.random() * caracteres.length)];
    }
    codigo = `EE-${anio}-${aleatorio}`;
    intentos++;
  } while (codigosSet.has(codigo) && intentos < 1000);

  return codigo;
}

async function evaluarEstadoCertificado(usuario) {
  const reglasGamif = await almacen.leerConfig('reglas-gamificacion');
  const reglasCert = (reglasGamif && reglasGamif.certificado) || {
    nivelQuizRequerido: 5,
    temasConNivelRequerido: 1,
    puntosMinimos: 400,
    temasRevisadosPct: 80
  };

  const logrosList = await almacen.buscar('logros', { usuarioId: usuario.id });
  const logro = logrosList[0] || { puntos: 0, nivelQuiz: {} };
  const puntosActuales = typeof logro.puntos === 'number' ? logro.puntos : 0;
  const nivelQuiz = logro.nivelQuiz || {};

  // 1. Temas con nivel de quiz requerido
  const nivelReq = Number(reglasCert.nivelQuizRequerido) || 5;
  const temasNivelAlcanzado = Object.values(nivelQuiz).filter(n => Number(n) >= nivelReq).length;
  const reqTemasNivel = Number(reglasCert.temasConNivelRequerido) || 1;
  const cumpleNivelQuiz = temasNivelAlcanzado >= reqTemasNivel;

  // 2. Puntos mínimos acumulados
  const reqPuntos = Number(reglasCert.puntosMinimos) || 400;
  const cumplePuntos = puntosActuales >= reqPuntos;

  // 3. Porcentaje de temas revisados sobre asignaturas del usuario
  const asignaturas = await acceso.asignaturasDe(usuario);
  const asigIds = new Set((asignaturas || []).map(a => a.id));

  const todasUnidades = await almacen.leer('unidades');
  const unidadesVisibles = (todasUnidades || []).filter(u => asigIds.has(u.asignaturaId) && u.visible !== false);
  const unidadesIds = new Set(unidadesVisibles.map(u => u.id));

  const todosTemas = await almacen.leer('temas');
  const temasPublicados = (todosTemas || []).filter(t => unidadesIds.has(t.unidadId) && t.estado === 'publicado');
  const totalTemas = temasPublicados.length;

  const progreso = await almacen.buscar('progreso-temas', { usuarioId: usuario.id });
  const temasPublicadosIds = new Set(temasPublicados.map(t => t.id));
  const temasRevisadosIds = new Set((progreso || []).filter(p => temasPublicadosIds.has(p.temaId)).map(p => p.temaId));
  const revisadosCount = temasRevisadosIds.size;

  const reqPct = Number(reglasCert.temasRevisadosPct) || 80;
  const pctActual = totalTemas > 0 ? Math.round((revisadosCount / totalTemas) * 100) : 0;
  const cumpleRevisados = pctActual >= reqPct;

  const condiciones = [
    {
      nombre: `Temas con Quiz nivel ${nivelReq}`,
      actual: temasNivelAlcanzado,
      requerido: reqTemasNivel,
      cumple: cumpleNivelQuiz
    },
    {
      nombre: 'Puntos mínimos acumulados',
      actual: puntosActuales,
      requerido: reqPuntos,
      cumple: cumplePuntos
    },
    {
      nombre: 'Temas revisados (%)',
      actual: pctActual,
      requerido: reqPct,
      cumple: cumpleRevisados
    }
  ];

  const cumpleTodo = cumpleNivelQuiz && cumplePuntos && cumpleRevisados;

  return { condiciones, cumple: cumpleTodo };
}

// GET /api/certificados/estado (con sesión)
router.get('/certificados/estado', async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Sesión requerida' });
    }
    const estado = await evaluarEstadoCertificado(req.usuario);
    return res.json(estado);
  } catch (err) {
    console.error('Error al evaluar estado de certificados:', err);
    return res.status(500).json({ error: 'Error al consultar estado de certificado' });
  }
});

// POST /api/certificados (con sesión)
router.post('/certificados', async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Sesión requerida' });
    }

    const { tipo, temaId, nivel } = req.body || {};
    if (!tipo || (tipo !== 'cumplimiento' && tipo !== 'nivel-quiz')) {
      return res.status(400).json({ error: 'Tipo de certificado no válido' });
    }

    const existentes = await almacen.leer('certificados');
    let detalle = '';

    if (tipo === 'nivel-quiz') {
      if (!temaId || nivel === undefined || nivel === null) {
        return res.status(400).json({ error: 'Se requiere temaId y nivel para certificado nivel-quiz' });
      }

      const logrosList = await almacen.buscar('logros', { usuarioId: req.usuario.id });
      const logro = logrosList[0] || {};
      const nivelAlcanzado = (logro.nivelQuiz && Number(logro.nivelQuiz[temaId])) || 0;
      const nivelSolicitado = Number(nivel);

      if (nivelAlcanzado < nivelSolicitado) {
        return res.status(400).json({ error: `Nivel alcanzado (${nivelAlcanzado}) inferior al requerido (${nivelSolicitado})` });
      }

      // Si ya existe uno igual, devolverlo
      const yaExiste = existentes.find(c =>
        c &&
        String(c.usuarioId) === String(req.usuario.id) &&
        c.tipo === 'nivel-quiz' &&
        c.temaId === temaId &&
        Number(c.nivel) === nivelSolicitado
      );

      if (yaExiste) {
        return res.json(yaExiste);
      }

      const temasEncontrados = await almacen.buscar('temas', { id: temaId });
      const tema = temasEncontrados[0];
      const nombreTema = tema ? tema.titulo : 'Tema Académico';
      detalle = `Por haber superado el Nivel ${nivelSolicitado} del Quiz en el tema «${nombreTema}»`;

    } else if (tipo === 'cumplimiento') {
      const estado = await evaluarEstadoCertificado(req.usuario);
      if (!estado.cumple) {
        return res.status(400).json({ error: 'Aún no cumples los requisitos de cumplimiento de estudios' });
      }

      // Si ya existe uno igual, devolverlo
      const yaExiste = existentes.find(c =>
        c &&
        String(c.usuarioId) === String(req.usuario.id) &&
        c.tipo === 'cumplimiento'
      );

      if (yaExiste) {
        return res.json(yaExiste);
      }

      detalle = 'Por haber completado con excelencia los objetivos formativos del programa';
    }

    const codigo = generarCodigoCertificado(existentes);
    const nombreCompleto = `${req.usuario.nombre || ''} ${req.usuario.apellido || ''}`.trim() || 'Estudiante';

    const nuevoCertificado = await almacen.agregar('certificados', {
      codigo,
      usuarioId: req.usuario.id,
      tipo,
      temaId: temaId || null,
      nivel: nivel !== undefined ? Number(nivel) : null,
      detalle,
      nombreCompleto
    });

    return res.json(nuevoCertificado);
  } catch (err) {
    console.error('Error al emitir certificado:', err);
    return res.status(500).json({ error: 'Error al emitir certificado' });
  }
});

// GET /api/certificados/verificar/:codigo (sin sesión)
router.get('/certificados/verificar/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    if (!codigo) {
      return res.json({ valido: false });
    }

    const codNormalizado = String(codigo).trim().toUpperCase();
    const certificados = await almacen.leer('certificados');
    const cert = certificados.find(c => c && String(c.codigo).toUpperCase() === codNormalizado);

    if (!cert) {
      return res.json({ valido: false });
    }

    return res.json({
      valido: true,
      nombreCompleto: cert.nombreCompleto,
      detalle: cert.detalle,
      fecha: cert.fecha,
      codigo: cert.codigo,
      tipo: cert.tipo
    });
  } catch (err) {
    console.error('Error al verificar certificado:', err);
    return res.json({ valido: false });
  }
});

export default router;
