// servidor/ganchos/noticias.js · Reglas de acceso y ciclo de vida de noticias

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];

  // Los estudiantes solo ven las publicadas
  if (usuario.rol === 'estudiante') {
    return lista.filter(n => n && n.estado === 'publicado');
  }

  // Docentes y admin ven todas
  return lista;
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    const error = new Error('Sesión requerida');
    error.estado = 401;
    throw error;
  }

  if (usuario.rol !== 'docente' && usuario.rol !== 'admin') {
    const error = new Error('No tienes permisos para crear o editar noticias');
    error.estado = 403;
    throw error;
  }

  // Fija autorId al crear
  if (!anterior) {
    datos.autorId = usuario.id;
  }

  // Fija fechaPublicacion cuando el estado pasa a "publicado"
  const estadoAnterior = anterior ? anterior.estado : null;
  const nuevoEstado = datos.estado !== undefined ? datos.estado : estadoAnterior;

  if (nuevoEstado === 'publicado' && estadoAnterior !== 'publicado') {
    datos.fechaPublicacion = new Date().toISOString();
  } else if (anterior && anterior.fechaPublicacion && !datos.fechaPublicacion) {
    datos.fechaPublicacion = anterior.fechaPublicacion;
  }

  return datos;
}

export async function despuesDeGuardar(reg, usuario, anterior) {
  if (!reg) return;

  const estadoAnterior = anterior ? anterior.estado : null;
  const nuevoEstado = reg.estado;

  // Notificar únicamente si pasó a "publicado"
  if (nuevoEstado === 'publicado' && estadoAnterior !== 'publicado') {
    try {
      const { notificar } = await import('../notificar.js');
      const almacen = await import('../almacen.js');
      const acceso = await import('../acceso.js');

      let destinatariosIds = new Set();

      if (reg.temaId) {
        // Asignatura del tema
        const asignaturaId = await acceso.asignaturaDeTema(reg.temaId);
        if (asignaturaId) {
          const distributivo = await almacen.leer('distributivo');
          (distributivo || [])
            .filter(g => g && String(g.asignaturaId) === String(asignaturaId))
            .forEach(g => {
              if (Array.isArray(g.estudiantes)) {
                g.estudiantes.forEach(estId => destinatariosIds.add(String(estId)));
              }
              if (g.docenteId) {
                destinatariosIds.add(String(g.docenteId));
              }
            });
        }
      }

      // Notificar a todos los estudiantes y docentes (y admin) de la plataforma
      const usuarios = await almacen.leer('usuarios');
      (usuarios || [])
        .filter(u => u && u.activo !== false)
        .forEach(u => {
          // Si no tiene tema específico, notificar a estudiantes
          if (!reg.temaId && u.rol === 'estudiante') {
            destinatariosIds.add(String(u.id));
          }
          // Siempre notificar a docentes y administradores (salvo el propio autor)
          if ((u.rol === 'docente' || u.rol === 'admin') && String(u.id) !== String(usuario?.id)) {
            destinatariosIds.add(String(u.id));
          }
        });

      // No notificar al propio autor que la creó
      if (usuario && usuario.id) {
        destinatariosIds.delete(String(usuario.id));
      }

      // Enlace a la noticia publicada
      const enlaceNoticia = `/paginas/noticia.html?id=${reg.id}`;
      const mensajeNotif = `Nueva noticia publicada: "${reg.titulo || 'Novedad académica'}"`;

      for (const destId of destinatariosIds) {
        await notificar(destId, {
          tipo: 'noticia',
          mensaje: mensajeNotif,
          enlace: enlaceNoticia
        });
      }
    } catch (errNotif) {
      console.error('Error al emitir notificaciones de noticia publicada:', errNotif);
    }
  }
}

export default {
  filtrarLista,
  antesDeGuardar,
  despuesDeGuardar
};

