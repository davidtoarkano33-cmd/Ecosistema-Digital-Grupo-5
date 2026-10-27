// servidor/ganchos/reportes.js · Creación segura y resolución administrativa
import * as almacen from '../almacen.js';
import { asignaturasDe } from '../acceso.js';

function rechazar(mensaje, estado = 400) {
  const error = new Error(mensaje);
  error.estado = estado;
  throw error;
}

function referenciaForo(valor) {
  const coincidencia = String(valor || '').match(/^(foros-hilos|foros-respuestas)\/(for_\d{6})$/);
  return coincidencia ? { coleccion: coincidencia[1], id: coincidencia[2] } : null;
}

function referenciaMensaje(valor) {
  const coincidencia = String(valor || '').match(/^(con_\d{6})\/(men_\d{6})$/);
  return coincidencia ? { conversacionId: coincidencia[1], mensajeId: coincidencia[2] } : null;
}

async function validarAccesoMensaje(usuario, referencia) {
  const [conversacion] = await almacen.buscar('conversaciones', { id: referencia.conversacionId });
  if (!conversacion) rechazar('La conversación reportada no existe', 404);
  if (!conversacion.participantes?.some(id => String(id) === String(usuario.id))) {
    rechazar('No tienes acceso a este mensaje', 403);
  }
  const [mensaje] = await almacen.buscar(`mensajes/${referencia.conversacionId}`, { id: referencia.mensajeId });
  if (!mensaje) rechazar('El mensaje reportado no existe', 404);
}

async function validarAccesoForo(usuario, referencia) {
  const [registro] = await almacen.buscar(referencia.coleccion, { id: referencia.id });
  if (!registro) rechazar('La publicación reportada no existe', 404);
  const hiloId = referencia.coleccion === 'foros-hilos' ? registro.id : registro.hiloId;
  const [hilo] = referencia.coleccion === 'foros-hilos'
    ? [registro]
    : await almacen.buscar('foros-hilos', { id: hiloId });
  if (!hilo) rechazar('El hilo reportado no existe', 404);
  const asignaturas = await asignaturasDe(usuario);
  if (!asignaturas.some(item => String(item.id) === String(hilo.asignaturaId))) {
    rechazar('No tienes acceso a esta publicación', 403);
  }
}

export async function filtrarLista(lista, usuario) {
  return usuario?.rol === 'admin' ? lista : [];
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) rechazar('Sesión requerida', 401);
  if (anterior) {
    if (usuario.rol !== 'admin') rechazar('Solo administradores pueden resolver reportes', 403);
    datos.tipo = anterior.tipo;
    datos.referenciaId = anterior.referenciaId;
    datos.reportadoPor = anterior.reportadoPor;
    datos.motivo = anterior.motivo;
    if (datos.estado !== undefined && !['pendiente', 'resuelto'].includes(datos.estado)) {
      rechazar('Estado de reporte no válido');
    }
    return datos;
  }

  if (!['foro', 'mensaje'].includes(datos.tipo)) rechazar('Tipo de reporte no válido');
  if (datos.tipo === 'foro') {
    const referencia = referenciaForo(datos.referenciaId);
    if (!referencia) rechazar('Referencia de foro no válida');
    await validarAccesoForo(usuario, referencia);
  } else {
    const referencia = referenciaMensaje(datos.referenciaId);
    if (!referencia) rechazar('Referencia de mensaje no válida');
    await validarAccesoMensaje(usuario, referencia);
  }
  const motivo = String(datos.motivo || '').trim();
  if (!motivo) rechazar('El motivo es obligatorio');
  if (motivo.length > 1000) rechazar('El motivo no puede superar 1.000 caracteres');
  datos.reportadoPor = usuario.id;
  datos.estado = 'pendiente';
  return datos;
}

export default { filtrarLista, antesDeGuardar };
