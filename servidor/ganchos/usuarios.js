// servidor/ganchos/usuarios.js · Reglas de negocio y protección para la colección usuarios

export function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista)) return [];
  return lista.map(u => {
    if (!u || typeof u !== 'object') return u;
    const { claveHash, ...resto } = u;
    return resto;
  });
}

export function antesDeGuardar(datos, usuario, anterior) {
  if (!datos || typeof datos !== 'object') {
    return datos;
  }

  // Ignora claveHash y correo al guardar o actualizar vía API genérica
  delete datos.claveHash;
  delete datos.correo;

  // Evita que un administrador se quite su propio rol o se desactive a sí mismo
  if (anterior && usuario && String(usuario.id) === String(anterior.id) && usuario.rol === 'admin') {
    if (datos.rol !== undefined && datos.rol !== 'admin') {
      const error = new Error('Un administrador no puede quitarse su propio rol');
      error.estado = 403;
      throw error;
    }

    if (datos.activo !== undefined && datos.activo === false) {
      const error = new Error('Un administrador no puede desactivarse a sí mismo');
      error.estado = 403;
      throw error;
    }
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
