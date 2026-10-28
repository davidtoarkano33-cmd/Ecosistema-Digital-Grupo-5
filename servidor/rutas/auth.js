// servidor/rutas/auth.js · Rutas de autenticación, perfil, bitácora y administración
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';

const router = Router();

// Control de intentos fallidos en memoria (máximo 5 en 15 minutos por correo)
const intentosFallidos = new Map();
const VENTANA_BLOQUEO_MS = 15 * 60 * 1000;
const MAX_FALLOS = 5;

function esBloqueadoPorIntentos(correoNorm) {
  const ahora = Date.now();
  const intentos = (intentosFallidos.get(correoNorm) || []).filter(t => ahora - t < VENTANA_BLOQUEO_MS);
  intentosFallidos.set(correoNorm, intentos);
  return intentos.length >= MAX_FALLOS;
}

function registrarIntentoFallido(correoNorm) {
  const ahora = Date.now();
  const intentos = (intentosFallidos.get(correoNorm) || []).filter(t => ahora - t < VENTANA_BLOQUEO_MS);
  intentos.push(ahora);
  intentosFallidos.set(correoNorm, intentos);
}

function limpiarIntentosFallidos(correoNorm) {
  intentosFallidos.delete(correoNorm);
}

function validarClaveFuerte(clave) {
  return typeof clave === 'string' &&
    clave.length >= 8 &&
    /[a-zA-Z]/.test(clave) &&
    /[0-9]/.test(clave);
}

function generarClaveTemporal(longitud = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let clave = '';
  const bytes = crypto.randomBytes(longitud);
  for (let i = 0; i < longitud; i++) {
    clave += chars[bytes[i] % chars.length];
  }
  return clave;
}

// POST /auth/registro
router.post('/auth/registro', async (req, res, next) => {
  try {
    const { nombre, apellido, correo, clave, consentimiento } = req.body;

    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    if (!apellido || typeof apellido !== 'string' || !apellido.trim()) {
      return res.status(400).json({ error: 'El apellido es obligatorio' });
    }
    if (!correo || typeof correo !== 'string') {
      return res.status(400).json({ error: 'El correo electrónico es obligatorio' });
    }

    const correoNorm = correo.trim().toLowerCase();
    const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexCorreo.test(correoNorm)) {
      return res.status(400).json({ error: 'El correo electrónico no tiene un formato válido' });
    }

    if (!validarClaveFuerte(clave)) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres y contener letras y números' });
    }

    if (consentimiento !== true) {
      return res.status(400).json({ error: 'Debe aceptar los términos de consentimiento' });
    }

    const usuarios = await almacen.leer('usuarios');
    const yaExiste = usuarios.some(u => u.correo && u.correo.toLowerCase() === correoNorm);
    if (yaExiste) {
      return res.status(400).json({ error: 'El correo electrónico ya se encuentra registrado' });
    }

    const claveHash = await bcrypt.hash(clave, 10);
    const nuevoUsuario = {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      correo: correoNorm,
      claveHash,
      rol: 'estudiante',
      activo: true,
      foto: null,
      consentimiento: {
        aceptado: true,
        fecha: new Date().toISOString()
      }
    };

    const creado = await almacen.agregar('usuarios', nuevoUsuario);
    res.status(201).json({
      id: creado.id,
      nombre: creado.nombre,
      apellido: creado.apellido,
      correo: creado.correo,
      rol: creado.rol
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/login
router.post('/auth/login', async (req, res, next) => {
  try {
    const { correo, clave } = req.body;
    if (!correo || typeof correo !== 'string' || !clave || typeof clave !== 'string') {
      return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
    }

    const correoNorm = correo.trim().toLowerCase();

    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find(u => u.correo && u.correo.toLowerCase() === correoNorm);

    if (!usuario || usuario.activo === false || !usuario.claveHash) {
      registrarIntentoFallido(correoNorm);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const coincide = await bcrypt.compare(clave, usuario.claveHash);
    if (!coincide) {
      registrarIntentoFallido(correoNorm);
      if (esBloqueadoPorIntentos(correoNorm)) {
        return res.status(429).json({ error: 'Demasiados intentos fallidos. Intente nuevamente en 15 minutos.' });
      }
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    // Éxito: limpiar historial de fallos
    limpiarIntentosFallidos(correoNorm);

    // Crear sesión (32 bytes aleatorios en hex, expira en 8 horas)
    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    await almacen.agregar('sesiones', {
      token,
      usuarioId: usuario.id,
      expira
    });

    // Registrar en bitácora
    await almacen.anexarLinea('bitacora.jsonl', {
      usuarioId: usuario.id,
      tipo: 'login',
      recurso: 'auth',
      fecha: new Date().toISOString()
    });

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: usuario.rol,
        foto: usuario.foto || null
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout
router.post('/auth/logout', async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : null;

    if (token) {
      const sesiones = await almacen.buscar('sesiones', { token });
      for (const s of sesiones) {
        await almacen.eliminar('sesiones', s.id);
      }
    }

    if (req.usuario) {
      await almacen.anexarLinea('bitacora.jsonl', {
        usuarioId: req.usuario.id,
        tipo: 'logout',
        recurso: 'auth',
        fecha: new Date().toISOString()
      });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /auth/yo
router.get('/auth/yo', exigirRol(), async (req, res, next) => {
  try {
    const usuarios = await almacen.buscar('usuarios', { id: req.usuario.id });
    const usuario = usuarios[0];

    if (!usuario || usuario.activo === false) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }

    res.json({
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      correo: usuario.correo,
      rol: usuario.rol,
      foto: usuario.foto || null
    });
  } catch (err) {
    next(err);
  }
});

// PUT /auth/perfil
router.put('/auth/perfil', exigirRol(), async (req, res, next) => {
  try {
    const { nombre, apellido, foto } = req.body;
    const cambios = {};

    if (typeof nombre === 'string' && nombre.trim()) {
      cambios.nombre = nombre.trim();
    }
    if (typeof apellido === 'string' && apellido.trim()) {
      cambios.apellido = apellido.trim();
    }
    if (foto !== undefined) {
      cambios.foto = foto;
    }

    const actualizado = await almacen.actualizar('usuarios', req.usuario.id, cambios);
    res.json({
      id: actualizado.id,
      nombre: actualizado.nombre,
      apellido: actualizado.apellido,
      correo: actualizado.correo,
      rol: actualizado.rol,
      foto: actualizado.foto || null
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/clave
router.post('/auth/clave', exigirRol(), async (req, res, next) => {
  try {
    const { actual, nueva } = req.body;

    if (!actual || typeof actual !== 'string') {
      return res.status(400).json({ error: 'La contraseña actual es obligatoria' });
    }

    if (!validarClaveFuerte(nueva)) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres y contener letras y números' });
    }

    const usuarios = await almacen.buscar('usuarios', { id: req.usuario.id });
    const usuario = usuarios[0];

    if (!usuario || !usuario.claveHash) {
      return res.status(400).json({ error: 'No se pudo verificar el usuario' });
    }

    const coincide = await bcrypt.compare(actual, usuario.claveHash);
    if (!coincide) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }

    const claveHash = await bcrypt.hash(nueva, 10);
    await almacen.actualizar('usuarios', req.usuario.id, { claveHash });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /admin/usuarios/:id/restablecer (admin)
router.post('/admin/usuarios/:id/restablecer', exigirRol('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuarios = await almacen.buscar('usuarios', { id });
    const usuario = usuarios[0];

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const claveTemporal = generarClaveTemporal(10);
    const claveHash = await bcrypt.hash(claveTemporal, 10);
    await almacen.actualizar('usuarios', id, { claveHash });

    res.json({ claveTemporal });
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/usuarios/:id/datos (admin) · Elimina la cuenta y sus datos vinculados
router.delete('/admin/usuarios/:id/datos', exigirRol('admin'), async (req, res, next) => {
  try {
    const id = String(req.params.id || '');
    if (id === String(req.usuario.id)) {
      return res.status(403).json({ error: 'No puedes eliminar tu propia cuenta' });
    }

    const [usuario] = await almacen.buscar('usuarios', { id });
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const grupos = await almacen.leer('distributivo');
    if (grupos.some(grupo => String(grupo?.docenteId) === id)) {
      return res.status(409).json({
        error: 'Reasigna o elimina primero los grupos donde este usuario figura como docente'
      });
    }

    const coleccionesPorUsuario = {
      sesiones: ['usuarioId'],
      agenda: ['propietarioId'],
      alertas: ['estudianteId', 'docenteId'],
      bloqueos: ['usuarioId', 'bloqueadoId'],
      certificados: ['usuarioId'],
      'consultas-tutor': ['usuarioId'],
      'historial-tutor': ['usuarioId'],
      intentos: ['usuarioId'],
      'lecturas-noticias': ['usuarioId'],
      logros: ['usuarioId'],
      notificaciones: ['usuarioId'],
      'progreso-temas': ['usuarioId'],
      'quiz-sesiones': ['usuarioId'],
      reportes: ['reportadoPor']
    };
    let eliminados = 0;

    for (const [coleccion, campos] of Object.entries(coleccionesPorUsuario)) {
      const lista = await almacen.leer(coleccion);
      const conservados = lista.filter(item => !campos.some(campo => String(item?.[campo]) === id));
      eliminados += lista.length - conservados.length;
      if (conservados.length !== lista.length) await almacen.escribir(coleccion, conservados);
    }

    const hilos = await almacen.leer('foros-hilos');
    const hilosEliminados = new Set(hilos.filter(item => String(item?.autorId) === id).map(item => String(item.id)));
    const hilosConservados = hilos.filter(item => !hilosEliminados.has(String(item?.id)));
    eliminados += hilos.length - hilosConservados.length;
    if (hilosConservados.length !== hilos.length) await almacen.escribir('foros-hilos', hilosConservados);

    const respuestas = await almacen.leer('foros-respuestas');
    const respuestasConservadas = respuestas.filter(item =>
      String(item?.autorId) !== id && !hilosEliminados.has(String(item?.hiloId))
    );
    eliminados += respuestas.length - respuestasConservadas.length;
    if (respuestasConservadas.length !== respuestas.length) {
      await almacen.escribir('foros-respuestas', respuestasConservadas);
    }

    const noticias = await almacen.leer('noticias');
    const noticiasEliminadas = new Set(noticias.filter(item => String(item?.autorId) === id).map(item => String(item.id)));
    const noticiasConservadas = noticias.filter(item => !noticiasEliminadas.has(String(item?.id)));
    eliminados += noticias.length - noticiasConservadas.length;
    if (noticiasConservadas.length !== noticias.length) await almacen.escribir('noticias', noticiasConservadas);
    if (noticiasEliminadas.size) {
      const lecturas = await almacen.leer('lecturas-noticias');
      const lecturasConservadas = lecturas.filter(item => !noticiasEliminadas.has(String(item?.noticiaId)));
      eliminados += lecturas.length - lecturasConservadas.length;
      if (lecturasConservadas.length !== lecturas.length) {
        await almacen.escribir('lecturas-noticias', lecturasConservadas);
      }
    }

    const conversaciones = await almacen.leer('conversaciones');
    const conversacionesEliminadas = conversaciones.filter(item =>
      Array.isArray(item?.participantes) && item.participantes.some(participante => String(participante) === id)
    );
    const conversacionesConservadas = conversaciones.filter(item => !conversacionesEliminadas.includes(item));
    eliminados += conversacionesEliminadas.length;
    if (conversacionesEliminadas.length) {
      await almacen.escribir('conversaciones', conversacionesConservadas);
      for (const conversacion of conversacionesEliminadas) {
        await almacen.escribir(`mensajes/${conversacion.id}`, []);
      }
    }

    const gruposActualizados = grupos.map(grupo => ({
      ...grupo,
      estudiantes: Array.isArray(grupo?.estudiantes)
        ? grupo.estudiantes.filter(estudianteId => String(estudianteId) !== id)
        : grupo?.estudiantes
    }));
    if (grupos.some(grupo => Array.isArray(grupo?.estudiantes) && grupo.estudiantes.some(estudianteId => String(estudianteId) === id))) {
      await almacen.escribir('distributivo', gruposActualizados);
    }

    await almacen.eliminar('usuarios', id);
    res.json({ ok: true, eliminados: eliminados + 1 });
  } catch (err) {
    next(err);
  }
});

// POST /eventos
router.post('/eventos', async (req, res, next) => {
  try {
    const { tipo, recurso } = req.body;
    if (!tipo || typeof tipo !== 'string') {
      return res.status(400).json({ error: 'El tipo de evento es obligatorio' });
    }

    await almacen.anexarLinea('bitacora.jsonl', {
      usuarioId: req.usuario ? req.usuario.id : null,
      tipo,
      recurso: recurso || null,
      fecha: new Date().toISOString()
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
