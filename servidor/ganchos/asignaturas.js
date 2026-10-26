// servidor/ganchos/asignaturas.js · Reglas de acceso para asignaturas
import { asignaturasDe } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const misAsignaturas = await asignaturasDe(usuario);
  const misIds = new Set(misAsignaturas.map(a => a.id));
  return lista.filter(item => misIds.has(item.id));
}

export default {
  filtrarLista
};
