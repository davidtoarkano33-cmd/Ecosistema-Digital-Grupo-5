// servidor/rutas/mensajes.js · Mensajería privada, difusión y moderación
import { Router } from 'express';
import * as almacen from '../almacen.js';
import { docentesIdsDeGrupo, esDocenteDeGrupo, gruposDe } from '../acceso.js';

const router = Router();
const enviosPorUsuario = new Map();
const LIMITE_POR_MINUTO = 30;

function rechazar(mensaje, estado = 400) {
  const error = new Error(mensaje);
  error.estado = estado;
  throw error;
}

function exigirSesion(req, res, next) {
  if (!req.usuario) return res.status(401).json({ error: 'Sesión requerida' });
  next();
}

function usuarioPublico(usuario) {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    rol: usuario.rol,
    foto: usuario.foto || null
  };
}

function validarTexto(valor) {
  const texto = String(valor || '').trim();
  if (!texto) rechazar('El texto del mensaje es obligatorio');
  if (texto.length > 2000) rechazar('El mensaje no puede superar 2.000 caracteres');
  return texto;
}

function registrarEnvio(usuarioId, cantidad = 1) {
  const ahora = Date.now();
  const desde = ahora - 60 * 1000;
  const recientes = (enviosPorUsuario.get(String(usuarioId)) || []).filter(fecha => fecha > desde);
  if (recientes.length + cantidad > LIMITE_POR_MINUTO) {
    rechazar('Límite de 30 mensajes por minuto superado', 429);
  }
  for (let i = 0; i < cantidad; i += 1) recientes.push(ahora);
  enviosPorUsuario.set(String(usuarioId), recientes);
}

async function estaBloqueadaRelacion(usuarioA, usuarioB) {
  const bloqueos = await almacen.leer('bloqueos');
  return (bloqueos || []).some(item => item && (
    (String(item.usuarioId) === String(usuarioA) && String(item.bloqueadoId) === String(usuarioB)) ||
    (String(item.usuarioId) === String(usuarioB) && String(item.bloqueadoId) === String(usuarioA))
  ));
}

async function obtenerContactosPermitidos(usuario) {
  const [usuarios, bloqueos, ajustes, grupos] = await Promise.all([
    almacen.leer('usuarios'),
    almacen.leer('bloqueos'),
    almacen.leerConfig('ajustes'),
    gruposDe(usuario)
  ]);
  const activos = (usuarios || []).filter(item => item && item.activo !== false && String(item.id) !== String(usuario.id));
  const bloqueados = new Set();
  for (const item of bloqueos || []) {
    if (!item) continue;
    if (String(item.usuarioId) === String(usuario.id)) bloqueados.add(String(item.bloqueadoId));
    if (String(item.bloqueadoId) === String(usuario.id)) bloqueados.add(String(item.usuarioId));
  }

  let idsPermitidos = new Set();
  if (usuario.rol === 'admin') {
    idsPermitidos = new Set(activos.map(item => String(item.id)));
  } else if (usuario.rol === 'docente') {
    for (const grupo of grupos || []) {
      for (const estudianteId of grupo.estudiantes || []) idsPermitidos.add(String(estudianteId));
    }
    activos.filter(item => item.rol === 'docente').forEach(item => idsPermitidos.add(String(item.id)));
  } else if (usuario.rol === 'estudiante') {
    for (const grupo of grupos || []) {
      docentesIdsDeGrupo(grupo).forEach(docenteId => idsPermitidos.add(docenteId));
      if (ajustes.chatEntreEstudiantes) {
        for (const estudianteId of grupo.estudiantes || []) idsPermitidos.add(String(estudianteId));
      }
    }
  }

  idsPermitidos.delete(String(usuario.id));
  return activos
    .filter(item => idsPermitidos.has(String(item.id)) && !bloqueados.has(String(item.id)))
    .map(usuarioPublico)
    .sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, 'es'));
}

async function obtenerConversacion(convId, usuario) {
  const [conversacion] = await almacen.buscar('conversaciones', { id: convId });
  if (!conversacion) rechazar('Conversación no encontrada', 404);
  if (!Array.isArray(conversacion.participantes) || !conversacion.participantes.some(id => String(id) === String(usuario.id))) {
    rechazar('No tienes acceso a esta conversación', 403);
  }
  return conversacion;
}

async function buscarConversacionEntre(usuarioA, usuarioB) {
  const conversaciones = await almacen.leer('conversaciones');
  return (conversaciones || []).find(item => {
    const participantes = (item?.participantes || []).map(String);
    return participantes.length === 2 && participantes.includes(String(usuarioA)) && participantes.includes(String(usuarioB));
  }) || null;
}

async function crearConversacion(usuarioA, usuarioB) {
  return almacen.agregar('conversaciones', {
    participantes: [String(usuarioA), String(usuarioB)],
    ultimo: null,
    leidoHasta: {
      [String(usuarioA)]: new Date().toISOString(),
      [String(usuarioB)]: null
    }
  });
}

async function obtenerOCrearConversacion(usuario, contactoId, validarContacto = true) {
  if (validarContacto) {
    const contactos = await obtenerContactosPermitidos(usuario);
    if (!contactos.some(item => String(item.id) === String(contactoId))) {
      rechazar('El usuario no es un contacto permitido', 403);
    }
  }
  let conversacion = await buscarConversacionEntre(usuario.id, contactoId);
  if (conversacion) return conversacion;
  conversacion = await crearConversacion(usuario.id, contactoId);
  return conversacion;
}

async function agregarMensaje(conversacion, autorId, texto, contarLimite = true) {
  const otroId = conversacion.participantes.find(id => String(id) !== String(autorId));
  if (!otroId) rechazar('La conversación no tiene un destinatario válido');
  if (await estaBloqueadaRelacion(autorId, otroId)) rechazar('No se puede enviar el mensaje porque existe un bloqueo', 403);
  if (contarLimite) registrarEnvio(autorId);

  const mensaje = await almacen.agregar(`mensajes/${conversacion.id}`, {
    autorId: String(autorId),
    texto,
    oculto: false
  });
  await almacen.actualizar('conversaciones', conversacion.id, {
    ultimo: { texto: mensaje.texto, fecha: mensaje.fecha, autorId: mensaje.autorId }
  });
  return mensaje;
}

router.use('/mensajes', exigirSesion);

// Las rutas fijas se declaran antes de /mensajes/:convId.
router.get('/mensajes/contactos', async (req, res, next) => {
  try {
    res.json({ contactos: await obtenerContactosPermitidos(req.usuario) });
  } catch (error) {
    next(error);
  }
});

router.get('/mensajes/conversaciones', async (req, res, next) => {
  try {
    const [conversaciones, usuarios, bloqueos] = await Promise.all([
      almacen.leer('conversaciones'),
      almacen.leer('usuarios'),
      almacen.leer('bloqueos')
    ]);
    const mapaUsuarios = new Map((usuarios || []).map(item => [String(item.id), item]));
    const mias = (conversaciones || []).filter(item =>
      item && Array.isArray(item.participantes) && item.participantes.some(id => String(id) === String(req.usuario.id))
    );

    const resultado = await Promise.all(mias.map(async conversacion => {
      const otroId = conversacion.participantes.find(id => String(id) !== String(req.usuario.id));
      const mensajes = await almacen.leer(`mensajes/${conversacion.id}`);
      const leidoHasta = new Date(conversacion.leidoHasta?.[req.usuario.id] || 0).getTime();
      const noLeidos = (mensajes || []).filter(item =>
        item && !item.oculto && String(item.autorId) !== String(req.usuario.id) && new Date(item.fecha).getTime() > leidoHasta
      ).length;
      const otro = mapaUsuarios.get(String(otroId));
      const bloqueoPropio = (bloqueos || []).find(item =>
        String(item?.usuarioId) === String(req.usuario.id) && String(item?.bloqueadoId) === String(otroId)
      );
      const bloqueoAjeno = (bloqueos || []).some(item =>
        String(item?.usuarioId) === String(otroId) && String(item?.bloqueadoId) === String(req.usuario.id)
      );
      return {
        ...conversacion,
        otro: otro ? usuarioPublico(otro) : null,
        noLeidos,
        bloqueadoPorMi: Boolean(bloqueoPropio),
        bloqueadoPorContacto: bloqueoAjeno
      };
    }));

    resultado.sort((a, b) => new Date(b.ultimo?.fecha || b.fecha || 0) - new Date(a.ultimo?.fecha || a.fecha || 0));
    const perfilActual = mapaUsuarios.get(String(req.usuario.id)) || req.usuario;
    res.json({
      conversaciones: resultado,
      usuario: usuarioPublico(perfilActual)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/mensajes/conversaciones', async (req, res, next) => {
  try {
    const contactoId = String(req.body?.con || '');
    if (!contactoId) rechazar('El contacto es obligatorio');
    const conversacion = await obtenerOCrearConversacion(req.usuario, contactoId, true);
    res.status(conversacion.fecha ? 200 : 201).json(conversacion);
  } catch (error) {
    next(error);
  }
});

router.get('/mensajes/no-leidos', async (req, res, next) => {
  try {
    const conversaciones = await almacen.leer('conversaciones');
    let total = 0;
    for (const conversacion of conversaciones || []) {
      if (!conversacion?.participantes?.some(id => String(id) === String(req.usuario.id))) continue;
      const leidoHasta = new Date(conversacion.leidoHasta?.[req.usuario.id] || 0).getTime();
      const mensajes = await almacen.leer(`mensajes/${conversacion.id}`);
      total += (mensajes || []).filter(item =>
        item && !item.oculto && String(item.autorId) !== String(req.usuario.id) && new Date(item.fecha).getTime() > leidoHasta
      ).length;
    }
    res.json({ total });
  } catch (error) {
    next(error);
  }
});

router.post('/mensajes/difusion', async (req, res, next) => {
  try {
    if (req.usuario.rol !== 'docente') rechazar('Solo docentes pueden enviar difusiones', 403);
    const grupoId = String(req.body?.grupoId || '');
    const texto = validarTexto(req.body?.texto);
    const grupos = await gruposDe(req.usuario);
    const grupo = grupos.find(item => String(item.id) === grupoId);
    if (!grupo || !esDocenteDeGrupo(grupo, req.usuario.id)) {
      rechazar('No tienes acceso al grupo indicado', 403);
    }

    const destinatarios = (grupo.estudiantes || []).map(String);
    const habilitados = [];
    for (const estudianteId of destinatarios) {
      if (await estaBloqueadaRelacion(req.usuario.id, estudianteId)) continue;
      habilitados.push(estudianteId);
    }
    registrarEnvio(req.usuario.id, habilitados.length);
    const enviados = [];
    const omitidos = destinatarios.filter(id => !habilitados.includes(id));
    for (const estudianteId of destinatarios) {
      if (!habilitados.includes(estudianteId)) continue;
      const conversacion = await obtenerOCrearConversacion(req.usuario, estudianteId, false);
      const mensaje = await agregarMensaje(conversacion, req.usuario.id, texto, false);
      enviados.push({ usuarioId: estudianteId, conversacionId: conversacion.id, mensajeId: mensaje.id });
    }
    res.json({ enviados, omitidos });
  } catch (error) {
    next(error);
  }
});

router.post('/mensajes/bloquear', async (req, res, next) => {
  try {
    const bloqueadoId = String(req.body?.usuarioId || '');
    if (!bloqueadoId) rechazar('usuarioId es obligatorio');
    if (bloqueadoId === String(req.usuario.id)) rechazar('No puedes bloquearte a ti mismo');
    const [objetivo] = await almacen.buscar('usuarios', { id: bloqueadoId });
    if (!objetivo || objetivo.activo === false) rechazar('Usuario no encontrado', 404);
    const existentes = await almacen.leer('bloqueos');
    const existente = (existentes || []).find(item =>
      String(item.usuarioId) === String(req.usuario.id) && String(item.bloqueadoId) === bloqueadoId
    );
    const bloqueo = existente || await almacen.agregar('bloqueos', {
      usuarioId: String(req.usuario.id),
      bloqueadoId
    });
    res.status(existente ? 200 : 201).json(bloqueo);
  } catch (error) {
    next(error);
  }
});

router.delete('/mensajes/bloquear/:usuarioId', async (req, res, next) => {
  try {
    const bloqueos = await almacen.leer('bloqueos');
    const bloqueo = (bloqueos || []).find(item =>
      String(item.usuarioId) === String(req.usuario.id) && String(item.bloqueadoId) === String(req.params.usuarioId)
    );
    if (!bloqueo) rechazar('Bloqueo no encontrado', 404);
    await almacen.eliminar('bloqueos', bloqueo.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/mensajes/reporte/:reporteId', async (req, res, next) => {
  try {
    if (req.usuario.rol !== 'admin') rechazar('Acceso exclusivo para administradores', 403);
    const [reporte] = await almacen.buscar('reportes', { id: req.params.reporteId });
    if (!reporte || reporte.tipo !== 'mensaje') rechazar('Reporte de mensaje no encontrado', 404);
    const coincidencia = String(reporte.referenciaId || '').match(/^(con_\d{6})\/(men_\d{6})$/);
    if (!coincidencia) rechazar('Referencia de mensaje no válida');
    const [, convId, mensajeId] = coincidencia;
    const mensajes = await almacen.leer(`mensajes/${convId}`);
    const indice = mensajes.findIndex(item => item?.id === mensajeId);
    if (indice === -1) rechazar('Mensaje reportado no encontrado', 404);
    res.json({
      reporte,
      mensaje: mensajes[indice],
      anteriores: mensajes.slice(Math.max(0, indice - 5), indice)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/mensajes/ocultar', async (req, res, next) => {
  try {
    if (req.usuario.rol !== 'admin') rechazar('Acceso exclusivo para administradores', 403);
    const coincidencia = String(req.body?.referenciaId || '').match(/^(con_\d{6})\/(men_\d{6})$/);
    if (!coincidencia) rechazar('Referencia de mensaje no válida');
    const [, convId, mensajeId] = coincidencia;
    const mensaje = await almacen.actualizar(`mensajes/${convId}`, mensajeId, { oculto: true });
    const mensajes = await almacen.leer(`mensajes/${convId}`);
    const ultimoVisible = [...mensajes]
      .filter(item => item && !item.oculto)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0] || null;
    await almacen.actualizar('conversaciones', convId, {
      ultimo: ultimoVisible
        ? { texto: ultimoVisible.texto, fecha: ultimoVisible.fecha, autorId: ultimoVisible.autorId }
        : null
    });
    res.json(mensaje);
  } catch (error) {
    next(error);
  }
});

router.get('/mensajes/:convId', async (req, res, next) => {
  try {
    const conversacion = await obtenerConversacion(req.params.convId, req.usuario);
    let mensajes = (await almacen.leer(`mensajes/${conversacion.id}`)).filter(item => item && !item.oculto);
    if (req.query.desde) {
      const desde = new Date(req.query.desde).getTime();
      if (!Number.isFinite(desde)) rechazar('Parámetro desde no válido');
      mensajes = mensajes.filter(item => new Date(item.fecha).getTime() > desde);
    }
    if (req.query.antes) {
      const antes = new Date(req.query.antes).getTime();
      if (!Number.isFinite(antes)) rechazar('Parámetro antes no válido');
      mensajes = mensajes.filter(item => new Date(item.fecha).getTime() < antes);
    }
    mensajes.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    res.json({ mensajes: mensajes.slice(-50) });
  } catch (error) {
    next(error);
  }
});

router.post('/mensajes/:convId/leido', async (req, res, next) => {
  try {
    const conversacion = await obtenerConversacion(req.params.convId, req.usuario);
    const leidoHasta = { ...(conversacion.leidoHasta || {}), [req.usuario.id]: new Date().toISOString() };
    const actualizada = await almacen.actualizar('conversaciones', conversacion.id, { leidoHasta });
    res.json(actualizada);
  } catch (error) {
    next(error);
  }
});

router.post('/mensajes/:convId', async (req, res, next) => {
  try {
    const conversacion = await obtenerConversacion(req.params.convId, req.usuario);
    const mensaje = await agregarMensaje(conversacion, req.usuario.id, validarTexto(req.body?.texto));
    res.status(201).json(mensaje);
  } catch (error) {
    next(error);
  }
});

export default router;
