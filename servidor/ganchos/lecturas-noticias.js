// servidor/ganchos/lecturas-noticias.js · Registro de lecturas de noticias por usuario
import * as almacen from '../almacen.js';

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];
  // Cada usuario solo ve sus propias lecturas
  return lista.filter(r => r && String(r.usuarioId) === String(usuario.id));
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    const error = new Error('Sesión requerida');
    error.estado = 401;
    throw error;
  }

  // Fija usuarioId al del usuario actual
  datos.usuarioId = usuario.id;

  if (!datos.noticiaId) {
    const error = new Error('noticiaId es obligatorio');
    error.estado = 400;
    throw error;
  }

  // Evita duplicados (usuarioId + noticiaId)
  const existentes = await almacen.buscar('lecturas-noticias', {
    usuarioId: datos.usuarioId,
    noticiaId: datos.noticiaId
  });

  const idActual = anterior ? anterior.id : (datos ? datos.id : null);
  const duplicado = existentes.some(r => !idActual || r.id !== idActual);

  if (duplicado) {
    const error = new Error('La lectura ya se encuentra registrada');
    error.estado = 400;
    throw error;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
