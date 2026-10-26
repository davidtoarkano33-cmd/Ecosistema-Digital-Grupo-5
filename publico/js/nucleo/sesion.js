// publico/js/nucleo/sesion.js · Gestión de sesión y control de acceso en el navegador
import { llamar } from './api.js';

export function token() {
  return sessionStorage.getItem('token');
}

export function usuarioActual() {
  try {
    const raw = sessionStorage.getItem('usuario');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function registrar(datos) {
  return await llamar('POST', '/api/auth/registro', datos);
}

export async function iniciar(correo, clave) {
  const respuesta = await llamar('POST', '/api/auth/login', { correo, clave });
  if (respuesta && respuesta.token && respuesta.usuario) {
    sessionStorage.setItem('token', respuesta.token);
    sessionStorage.setItem('usuario', JSON.stringify(respuesta.usuario));
    return respuesta.usuario;
  }
  throw new Error('Respuesta de sesión incompleta');
}

export async function cerrar() {
  try {
    await llamar('POST', '/api/auth/logout');
  } catch {
    // Si la sesión ya expiró o falla la red, se procede con la limpieza local
  } finally {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('usuario');
    window.location.href = '/paginas/ingreso.html';
  }
}

export function exigirRol(roles = []) {
  if (!roles || roles.length === 0 || roles.includes('publico')) {
    return true;
  }

  const usuario = usuarioActual();

  // Sin sesión → redirige a ingreso
  if (!usuario) {
    window.location.href = '/paginas/ingreso.html';
    return false;
  }

  // Si tiene sesión y se acepta 'sesion' o coincide su rol
  if (roles.includes('sesion') || roles.includes(usuario.rol)) {
    return true;
  }

  // Rol no permitido → redirige a /index.html con un aviso
  sessionStorage.setItem('aviso_pendiente', JSON.stringify({
    texto: 'Acceso no permitido para tu rol actual.',
    tipo: 'error'
  }));
  window.location.href = '/index.html';
  return false;
}

export default {
  token,
  usuarioActual,
  registrar,
  iniciar,
  cerrar,
  exigirRol
};
