// servidor/ganchos/distributivo.js · Reglas de acceso para distributivo
import { gruposDe } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const misGrupos = await gruposDe(usuario);
  const misIds = new Set(misGrupos.map(g => g.id));
  return lista.filter(item => misIds.has(item.id));
}

export default {
  filtrarLista
};
