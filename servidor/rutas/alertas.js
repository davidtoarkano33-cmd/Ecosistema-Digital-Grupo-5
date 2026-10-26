// servidor/rutas/alertas.js · Ruta para consultar alertas y mensajes de apoyo
import { Router } from 'express';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

const router = Router();

// GET /alertas?grupoId= (docente del grupo o admin) → { alertas, mensajesApoyo }
router.get('/alertas', async (req, res) => {
  try {
    const usuario = req.usuario;
    if (!usuario) {
      return res.status(401).json({ error: 'Sesión no iniciada' });
    }

    if (usuario.rol !== 'docente' && usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo docentes o administradores pueden acceder a las alertas' });
    }

    const { grupoId, estudianteId } = req.query;

    const [todasAlertas, todosDistributivos, reglasAlertas] = await Promise.all([
      almacen.leer('alertas'),
      almacen.leer('distributivo'),
      almacen.leerConfig('reglas-alertas')
    ]);

    let alertasFiltradas = todasAlertas || [];

    // Si se pasa grupoId, validar acceso y filtrar
    if (grupoId) {
      const grupo = (todosDistributivos || []).find(g => g && String(g.id) === String(grupoId));
      if (!grupo) {
        return res.status(404).json({ error: 'Grupo no encontrado' });
      }

      if (usuario.rol !== 'admin' && String(grupo.docenteId) !== String(usuario.id)) {
        return res.status(403).json({ error: 'No tienes permiso para ver las alertas de este grupo' });
      }

      alertasFiltradas = alertasFiltradas.filter(a => a && String(a.grupoId) === String(grupoId));
    } else if (usuario.rol === 'docente') {
      // Si no especificó grupoId, filtrar por todos los grupos del docente
      const misGrupos = (todosDistributivos || []).filter(g => g && String(g.docenteId) === String(usuario.id));
      const misGruposIds = new Set(misGrupos.map(g => String(g.id)));
      alertasFiltradas = alertasFiltradas.filter(a => a && misGruposIds.has(String(a.grupoId)));
    }

    // Filtro adicional opcional por estudianteId
    if (estudianteId) {
      alertasFiltradas = alertasFiltradas.filter(a => a && String(a.estudianteId) === String(estudianteId));
    }

    // Ordenar alertas: activas primero, luego por fecha descendente
    alertasFiltradas.sort((a, b) => {
      if (a.estado === 'activa' && b.estado !== 'activa') return -1;
      if (a.estado !== 'activa' && b.estado === 'activa') return 1;
      return new Date(b.fecha || 0) - new Date(a.fecha || 0);
    });

    const mensajesApoyo = (reglasAlertas && Array.isArray(reglasAlertas.mensajesApoyo))
      ? reglasAlertas.mensajesApoyo
      : [
          "Vi que este tema te está costando. ¿Lo repasamos juntos? Estoy para ayudarte.",
          "Te extrañamos en la plataforma. Hay una actividad corta para retomar el ritmo.",
          "¡Buen esfuerzo! Repasa el tema y vuelve a intentarlo: vas por buen camino."
        ];

    return res.json({
      alertas: alertasFiltradas,
      mensajesApoyo
    });
  } catch (err) {
    console.error('Error en GET /alertas:', err);
    return res.status(500).json({ error: err.message || 'Error al obtener alertas' });
  }
});

export default router;
