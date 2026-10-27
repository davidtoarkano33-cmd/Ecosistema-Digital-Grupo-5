// servidor/rutas/agenda.js · Rutas de agenda: recordatorios y control de eliminación
import { Router } from 'express';
import * as almacen from '../almacen.js';
import { gruposDe } from '../acceso.js';
import { notificar } from '../notificar.js';

const router = Router();

// GET /agenda/recordatorios · Obtiene eventos próximos con recordatorios pendientes para el usuario
router.get('/agenda/recordatorios', async (req, res, next) => {
  try {
    const usuario = req.usuario;
    if (!usuario) {
      return res.status(401).json({ error: 'Sesión requerida' });
    }

    const todos = await almacen.leer('agenda');
    const misGrupos = await gruposDe(usuario);
    const misGruposIds = new Set((misGrupos || []).map(g => String(g.id)));

    const ahora = Date.now();
    const pendientes = [];

    for (const ev of todos || []) {
      if (!ev) continue;
      const esPropio = String(ev.propietarioId) === String(usuario.id);
      const esDeMiGrupo = ev.grupoId && misGruposIds.has(String(ev.grupoId));
      if (!esPropio && !esDeMiGrupo) continue;

      const inicioMs = new Date(ev.inicio).getTime();
      if (!Number.isFinite(inicioMs) || !Array.isArray(ev.recordatorios)) continue;

      const avisados = ev.avisados && typeof ev.avisados === 'object' ? { ...ev.avisados } : {};
      const avisosUsuario = Array.isArray(avisados[usuario.id]) ? [...avisados[usuario.id]] : [];
      let cambio = false;

      for (const valor of ev.recordatorios) {
        const minAviso = Number(valor);
        if (!Number.isFinite(minAviso) || avisosUsuario.includes(minAviso)) continue;

        const momentoAviso = inicioMs - minAviso * 60 * 1000;
        if (ahora >= momentoAviso) {
          const minutosRestantes = Math.max(0, Math.ceil((inicioMs - ahora) / 60000));
          const mensaje = inicioMs > ahora
            ? `Recordatorio: "${ev.titulo}" comienza en ${minutosRestantes} minutos.`
            : `Recordatorio: "${ev.titulo}" ya comenzó.`;
          const notificacion = await notificar(usuario.id, {
            tipo: 'agenda',
            mensaje,
            enlace: '/paginas/agenda.html'
          });

          avisosUsuario.push(minAviso);
          cambio = true;
          pendientes.push({
            eventoId: ev.id,
            notificacionId: notificacion.id,
            titulo: ev.titulo,
            mensaje,
            tipo: ev.tipo,
            inicio: ev.inicio,
            minutosRestantes,
            minutoAviso: minAviso,
            enlace: '/paginas/agenda.html'
          });
        }
      }

      if (cambio) {
        avisados[usuario.id] = avisosUsuario;
        await almacen.actualizar('agenda', ev.id, { avisados });
      }
    }

    return res.json({ recordatorios: pendientes });
  } catch (err) {
    next(err);
  }
});

// DELETE /agenda/:id · Solo el propietario (o admin) puede eliminar un evento
router.delete('/agenda/:id', async (req, res, next) => {
  try {
    const usuario = req.usuario;
    if (!usuario) {
      return res.status(401).json({ error: 'Sesión requerida' });
    }

    const { id } = req.params;
    const eventos = await almacen.buscar('agenda', { id });
    const evento = eventos[0];

    if (!evento) {
      return res.status(404).json({ error: 'Evento de agenda no encontrado' });
    }

    if (usuario.rol !== 'admin' && String(evento.propietarioId) !== String(usuario.id)) {
      return res.status(403).json({ error: 'Solo el propietario puede eliminar este evento' });
    }

    const eliminado = await almacen.eliminar('agenda', id);
    return res.json({ ok: true, eliminado });
  } catch (err) {
    next(err);
  }
});

export default router;
