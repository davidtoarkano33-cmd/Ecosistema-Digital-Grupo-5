// servidor/auth.js · Autenticación, control de roles y limpieza de sesiones
import * as almacen from './almacen.js';

// Al cargarse el módulo, purga las sesiones que ya han expirado
async function purgarSesionesVencidas() {
  try {
    const sesiones = await almacen.leer('sesiones');
    const ahora = new Date();
    const vigentes = sesiones.filter(s => s.expira && new Date(s.expira) > ahora);
    if (vigentes.length !== sesiones.length) {
      await almacen.escribir('sesiones', vigentes);
    }
  } catch {
    // Si la colección aún no existe o está vacía, no bloquea el inicio
  }
}

purgarSesionesVencidas();

export async function cargarUsuario(req, res, next) {
  req.usuario = null;
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader || typeof authHeader !== 'string') {
    return next();
  }

  const partes = authHeader.trim().split(/\s+/);
  if (partes.length !== 2 || partes[0].toLowerCase() !== 'bearer') {
    return next();
  }

  const token = partes[1];
  try {
    const sesiones = await almacen.buscar('sesiones', { token });
    const sesion = sesiones[0];

    if (!sesion || !sesion.expira) {
      return next();
    }

    if (new Date(sesion.expira) <= new Date()) {
      return next();
    }

    const usuarios = await almacen.buscar('usuarios', { id: sesion.usuarioId });
    const usuario = usuarios[0];

    if (!usuario || usuario.activo === false) {
      return next();
    }

    req.usuario = {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol,
      foto: usuario.foto || null
    };
  } catch (err) {
    console.error('Error al cargar sesión en middleware:', err);
  }

  next();
}

export function exigirRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autorizado: sesión requerida' });
    }

    if (roles.length > 0 && !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'Acceso denegado: permisos insuficientes' });
    }

    next();
  };
}

export default {
  cargarUsuario,
  exigirRol
};
