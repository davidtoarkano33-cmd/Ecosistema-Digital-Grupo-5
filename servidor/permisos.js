// servidor/permisos.js · Control de acceso por rol y propiedad según permisos.json
import { leerConfig } from './almacen.js';

export async function puede(usuario, accion, col, registro = null) {
  if (!accion || !col) {
    return false;
  }

  const permisos = await leerConfig('permisos');

  // Buscar configuración por colección completa o colección base
  let configCol = permisos[col];
  if (!configCol && col.includes('/')) {
    configCol = permisos[col.split('/')[0]];
  }

  // Colección no listada → false
  if (!configCol) {
    return false;
  }

  const reglasAccion = configCol[accion];
  if (!Array.isArray(reglasAccion)) {
    return false;
  }

  for (const regla of reglasAccion) {
    // "servidor" nunca se permite desde la API
    if (regla === 'servidor') {
      continue;
    }

    if (regla === 'publico') {
      return true;
    }

    if (!usuario) {
      continue;
    }

    if (regla === 'sesion') {
      return true;
    }

    if (regla === usuario.rol) {
      return true;
    }

    // "propio" compara registro.usuarioId con usuario.id
    if (regla === 'propio') {
      if (!registro) {
        return true;
      }
      if (registro.usuarioId && usuario.id && String(registro.usuarioId) === String(usuario.id)) {
        return true;
      }
      if ((col === 'usuarios' || col.startsWith('usuarios/')) && registro.id && usuario.id && String(registro.id) === String(usuario.id)) {
        return true;
      }
    }
  }

  return false;
}
