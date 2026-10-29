// servidor/ganchos/autores.js · Validación de perfiles públicos de autoría

const CAMPOS_EDITABLES = ['nombre', 'rol', 'frase', 'materia', 'foto', 'orden', 'principal'];

function texto(valor, maximo) {
  return String(valor ?? '').trim().slice(0, maximo);
}

function validarFoto(valor) {
  const foto = texto(valor, 500);
  if (!foto) return null;
  if (foto.startsWith('/recursos/') || /^https:\/\//i.test(foto)) return foto;

  const error = new Error('La foto debe proceder de Recursos o utilizar una dirección HTTPS');
  error.estado = 400;
  throw error;
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) {
    const error = new Error('Sesión requerida');
    error.estado = 401;
    throw error;
  }
  if (usuario.rol !== 'admin') {
    const error = new Error('Solo el administrador puede editar la autoría');
    error.estado = 403;
    throw error;
  }

  const cambios = {};
  for (const campo of CAMPOS_EDITABLES) {
    if (Object.prototype.hasOwnProperty.call(datos, campo)) cambios[campo] = datos[campo];
  }

  const combinado = { ...(anterior || {}), ...cambios };
  combinado.nombre = texto(combinado.nombre, 120);
  combinado.rol = texto(combinado.rol, 120);
  combinado.frase = texto(combinado.frase, 280);
  combinado.materia = texto(combinado.materia, 160);
  combinado.foto = validarFoto(combinado.foto);
  combinado.orden = Math.max(1, Math.min(100, Number(combinado.orden) || 1));
  combinado.principal = Boolean(combinado.principal);

  if (!combinado.nombre || !combinado.rol) {
    const error = new Error('El nombre y el rol del autor son obligatorios');
    error.estado = 400;
    throw error;
  }

  return anterior
    ? Object.fromEntries(CAMPOS_EDITABLES.filter(campo => campo in cambios).map(campo => [campo, combinado[campo]]))
    : Object.fromEntries(CAMPOS_EDITABLES.map(campo => [campo, combinado[campo]]));
}

export default { antesDeGuardar };
