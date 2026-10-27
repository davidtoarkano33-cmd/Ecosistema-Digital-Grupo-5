// servidor/ganchos/foros-respuestas.js · Respuestas, moderación y actividad del foro
import * as almacen from '../almacen.js';
import { asignaturasDe } from '../acceso.js';
import { notificar } from '../notificar.js';
import { procesarIntento } from '../gamificacion.js';

const VENTANA_EDICION_MS = 15 * 60 * 1000;
const CAMPOS_MODERACION = ['destacada', 'oculta'];

function rechazar(mensaje, estado = 400) {
  const error = new Error(mensaje);
  error.estado = estado;
  throw error;
}

function puedeModerar(usuario) {
  return usuario?.rol === 'docente' || usuario?.rol === 'admin';
}

function dentroDeVentana(registro) {
  const creado = new Date(registro?.fecha || 0).getTime();
  return Number.isFinite(creado) && Date.now() - creado <= VENTANA_EDICION_MS;
}

async function contextoHilo(hiloId, usuario) {
  const [hilo] = await almacen.buscar('foros-hilos', { id: hiloId });
  if (!hilo) rechazar('Hilo no encontrado', 404);
  const asignaturas = await asignaturasDe(usuario);
  if (!asignaturas.some(item => String(item.id) === String(hilo.asignaturaId))) {
    rechazar('No tienes acceso a este hilo', 403);
  }
  return hilo;
}

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];
  const asignaturas = await asignaturasDe(usuario);
  const permitidas = new Set(asignaturas.map(item => String(item.id)));
  const hilos = await almacen.leer('foros-hilos');
  const mapaHilos = new Map(hilos.map(item => [String(item.id), item]));
  return lista.filter(respuesta => {
    const hilo = mapaHilos.get(String(respuesta?.hiloId));
    return hilo &&
      permitidas.has(String(hilo.asignaturaId)) &&
      (!hilo.oculto || puedeModerar(usuario)) &&
      (!respuesta.oculta || puedeModerar(usuario));
  });
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) rechazar('Sesión requerida', 401);
  const combinado = { ...(anterior || {}), ...(datos || {}) };
  const hiloId = anterior?.hiloId || combinado.hiloId;
  if (!hiloId) rechazar('El hilo es obligatorio');
  const hilo = await contextoHilo(hiloId, usuario);

  if (anterior) {
    const esAutorEnTiempo = String(anterior.autorId) === String(usuario.id) && dentroDeVentana(anterior);
    if (!esAutorEnTiempo && !puedeModerar(usuario)) {
      rechazar('Solo puedes editar tus respuestas durante los primeros 15 minutos', 403);
    }
    datos.autorId = anterior.autorId;
    datos.hiloId = anterior.hiloId;
    if (!puedeModerar(usuario)) {
      for (const campo of CAMPOS_MODERACION) {
        if (Object.prototype.hasOwnProperty.call(datos, campo) && datos[campo] !== anterior[campo]) {
          rechazar('Solo docentes y administradores pueden moderar respuestas', 403);
        }
      }
    }
  } else {
    if (hilo.cerrado) rechazar('Este hilo está cerrado y no admite respuestas', 409);
    datos.autorId = usuario.id;
    datos.destacada = puedeModerar(usuario) ? Boolean(datos.destacada) : false;
    datos.oculta = puedeModerar(usuario) ? Boolean(datos.oculta) : false;
  }

  const texto = String(combinado.texto || '').trim();
  if (!texto) rechazar('El texto es obligatorio');
  if (texto.length > 5000) rechazar('El texto no puede superar 5.000 caracteres');
  return datos;
}

export async function despuesDeGuardar(registro, usuario, anterior) {
  if (!registro || anterior) return;
  const [hilo] = await almacen.buscar('foros-hilos', { id: registro.hiloId });
  if (!hilo) return;
  await almacen.actualizar('foros-hilos', hilo.id, { ultimoMovimiento: new Date().toISOString() });

  try {
    const destinatarios = new Set();
    if (hilo.autorId && String(hilo.autorId) !== String(usuario.id)) {
      destinatarios.add(String(hilo.autorId));
    }

    const distributivo = await almacen.leer('distributivo');
    for (const g of distributivo || []) {
      if (String(g.asignaturaId) === String(hilo.asignaturaId)) {
        if (g.docenteId && String(g.docenteId) !== String(usuario.id)) {
          destinatarios.add(String(g.docenteId));
        }
      }
    }

    const respuestasPrevias = await almacen.buscar('foros-respuestas', { hiloId: hilo.id });
    for (const r of respuestasPrevias || []) {
      if (r.autorId && String(r.autorId) !== String(usuario.id)) {
        destinatarios.add(String(r.autorId));
      }
    }

    for (const destId of destinatarios) {
      await notificar(destId, {
        tipo: 'foro-respuesta',
        mensaje: `Nueva respuesta en "${hilo.titulo}"`,
        enlace: `/paginas/hilo.html?id=${encodeURIComponent(hilo.id)}`
      });
    }
  } catch (error) {
    console.error('No se pudo notificar la respuesta del foro:', error);
  }

  try {
    await procesarIntento(usuario, {
      actividad: 'foro',
      temaId: hilo.temaId || null,
      puntaje: 1,
      maximo: 1,
      errores: 0,
      duracionSeg: 0,
      detalle: { hiloId: hilo.id }
    });
  } catch (error) {
    console.error('No se pudo registrar la participación en foro:', error);
  }
}

export default { filtrarLista, antesDeGuardar, despuesDeGuardar };
