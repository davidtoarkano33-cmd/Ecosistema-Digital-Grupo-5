// publico/js/nucleo/distributivo.js · Compatibilidad de grupos con varios docentes
export function docentesIdsDeGrupo(grupo) {
  const ids = Array.isArray(grupo?.docentesIds) ? [...grupo.docentesIds] : [];
  if (grupo?.docenteId) ids.push(grupo.docenteId);
  return [...new Set(ids.filter(Boolean).map(String))];
}

export function esDocenteDeGrupo(grupo, usuarioId) {
  return Boolean(usuarioId) && docentesIdsDeGrupo(grupo).includes(String(usuarioId));
}

export default { docentesIdsDeGrupo, esDocenteDeGrupo };
