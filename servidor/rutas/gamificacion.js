// servidor/rutas/gamificacion.js · Rutas de intentos y logros
import { Router } from 'express';
import { procesarIntento } from '../gamificacion.js';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

const router = Router();

// POST /intentos
router.post('/intentos', async (req, res, next) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Sesión requerida' });
    }

    const resultado = await procesarIntento(req.usuario, req.body);
    res.status(200).json(resultado);
  } catch (err) {
    if (err.estado) {
      return res.status(err.estado).json({ error: err.message });
    }
    next(err);
  }
});

// GET /logros/:usuarioId
router.get('/logros/:usuarioId', async (req, res, next) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Sesión requerida' });
    }

    const { usuarioId } = req.params;
    const targetId = usuarioId === 'yo' ? String(req.usuario.id) : String(usuarioId);

    // Verificación de permisos: propio, docente de sus grupos, o admin
    let permitido = false;

    if (req.usuario.rol === 'admin') {
      permitido = true;
    } else if (String(req.usuario.id) === targetId) {
      permitido = true;
    } else if (req.usuario.rol === 'docente') {
      const estudiantes = await acceso.estudiantesDe(req.usuario.id);
      permitido = estudiantes.some(e => e && String(e.id) === targetId);
    }

    if (!permitido) {
      return res.status(403).json({ error: 'Acceso no permitido a los logros de este usuario' });
    }

    const lista = await almacen.buscar('logros', { usuarioId: targetId });
    const logro = lista[0] || { puntos: 0, insignias: [], nivelQuiz: {} };

    res.json({
      puntos: typeof logro.puntos === 'number' ? logro.puntos : 0,
      insignias: Array.isArray(logro.insignias) ? logro.insignias : [],
      nivelQuiz: logro.nivelQuiz || {}
    });
  } catch (err) {
    next(err);
  }
});

export default router;
