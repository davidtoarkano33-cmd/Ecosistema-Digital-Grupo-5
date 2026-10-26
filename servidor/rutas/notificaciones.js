// servidor/rutas/notificaciones.js · Rutas para el centro de notificaciones
import { Router } from 'express';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';
import { notificar } from '../notificar.js';

const router = Router();

// 1. GET /notificaciones (mías, las 30 más recientes, con el total sin leer)
router.get('/notificaciones', async (req, res) => {
  try {
    const usuario = req.usuario;
    if (!usuario) {
      return res.status(401).json({ error: 'Sesión no iniciada' });
    }

    const todas = await almacen.leer('notificaciones');
    const mias = (todas || [])
      .filter(n => n && String(n.usuarioId) === String(usuario.id))
      .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

    const totalSinLeer = mias.filter(n => n.leida === false).length;
    const recientes = mias.slice(0, 30);

    return res.json({
      notificaciones: recientes,
      totalSinLeer
    });
  } catch (err) {
    console.error('Error en GET /notificaciones:', err);
    return res.status(500).json({ error: err.message || 'Error al obtener notificaciones' });
  }
});

// 2. POST /notificaciones { usuarioId, mensaje, enlace }
// (docente a sus estudiantes; admin a cualquiera; tipo "mensaje-docente")
router.post('/notificaciones', async (req, res) => {
  try {
    const usuario = req.usuario;
    if (!usuario) {
      return res.status(401).json({ error: 'Sesión no iniciada' });
    }

    const { usuarioId, mensaje, enlace } = req.body || {};

    if (!usuarioId || !mensaje) {
      return res.status(400).json({ error: 'usuarioId y mensaje son obligatorios' });
    }

    // Comprobación de permisos
    if (usuario.rol === 'admin') {
      // Admin puede enviar a cualquiera
    } else if (usuario.rol === 'docente') {
      // Debe ser estudiante de alguno de sus grupos
      const estudiantesDocente = await acceso.estudiantesDe(usuario.id);
      const esEstudianteSuyo = (estudiantesDocente || []).some(est => est && String(est.id) === String(usuarioId));
      if (!esEstudianteSuyo) {
        return res.status(403).json({ error: 'Solo puedes enviar notificaciones a estudiantes de tus grupos asignados' });
      }
    } else {
      return res.status(403).json({ error: 'No tienes permisos para emitir notificaciones' });
    }

    const tipoNotif = usuario.rol === 'admin' ? 'mensaje-admin' : 'mensaje-docente';
    const nueva = await notificar(usuarioId, {
      tipo: tipoNotif,
      mensaje,
      enlace: enlace || ''
    });

    return res.status(201).json(nueva);
  } catch (err) {
    console.error('Error en POST /notificaciones:', err);
    return res.status(err.estado || 500).json({ error: err.message || 'Error al crear notificación' });
  }
});

// 3. POST /notificaciones/:id/leida
router.post('/notificaciones/:id/leida', async (req, res) => {
  try {
    const usuario = req.usuario;
    if (!usuario) {
      return res.status(401).json({ error: 'Sesión no iniciada' });
    }

    const { id } = req.params;
    const notificaciones = await almacen.buscar('notificaciones', { id });
    const notif = notificaciones[0];

    if (!notif) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    if (String(notif.usuarioId) !== String(usuario.id) && usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso sobre esta notificación' });
    }

    const actualizada = await almacen.actualizar('notificaciones', id, { leida: true });
    return res.json(actualizada);
  } catch (err) {
    console.error('Error en POST /notificaciones/:id/leida:', err);
    return res.status(err.estado || 500).json({ error: err.message || 'Error al marcar notificación como leída' });
  }
});

// 4. POST /notificaciones/leidas (marcar todas las mías como leídas)
router.post('/notificaciones/leidas', async (req, res) => {
  try {
    const usuario = req.usuario;
    if (!usuario) {
      return res.status(401).json({ error: 'Sesión no iniciada' });
    }

    const todas = await almacen.leer('notificaciones');
    let modificadas = 0;

    for (const n of (todas || [])) {
      if (n && String(n.usuarioId) === String(usuario.id) && n.leida === false) {
        n.leida = true;
        modificadas++;
      }
    }

    if (modificadas > 0) {
      await almacen.escribir('notificaciones', todas);
    }

    return res.json({ ok: true, marcadas: modificadas });
  } catch (err) {
    console.error('Error en POST /notificaciones/leidas:', err);
    return res.status(500).json({ error: err.message || 'Error al marcar todas las notificaciones como leídas' });
  }
});

export default router;
