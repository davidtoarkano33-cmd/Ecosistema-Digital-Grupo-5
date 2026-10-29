// servidor/ganchos/foros-hilos.js · Acceso, autoría y moderación de hilos
import * as almacen from '../almacen.js';
import { asignaturasDe, docentesIdsDeGrupo } from '../acceso.js';

import { notificar } from '../notificar.js';

const VENTANA_EDICION_MS = 15 * 60 * 1000;
const CAMPOS_MODERACION = ['fijado', 'cerrado', 'oculto'];

function rechazar(mensaje, estado = 400) {
  const error = new Error(mensaje);
  error.estado = estado;
  throw error;
}

async function tieneAsignatura(usuario, asignaturaId) {
  const asignaturas = await asignaturasDe(usuario);
  return asignaturas.some(item => String(item.id) === String(asignaturaId));
}

function puedeModerar(usuario) {
  return usuario?.rol === 'docente' || usuario?.rol === 'admin';
}

function dentroDeVentana(registro) {
  const creado = new Date(registro?.fecha || 0).getTime();
  return Number.isFinite(creado) && Date.now() - creado <= VENTANA_EDICION_MS;
}

export async function filtrarLista(lista, usuario) {
  if (!usuario) return [];
  const asignaturas = await asignaturasDe(usuario);
  const permitidas = new Set(asignaturas.map(item => String(item.id)));
  return lista.filter(hilo =>
    hilo &&
    permitidas.has(String(hilo.asignaturaId)) &&
    (!hilo.oculto || puedeModerar(usuario))
  );
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario) rechazar('Sesión requerida', 401);
  const combinado = { ...(anterior || {}), ...(datos || {}) };
  const asignaturaId = anterior?.asignaturaId || combinado.asignaturaId;
  if (!asignaturaId) rechazar('La asignatura es obligatoria');
  if (!await tieneAsignatura(usuario, asignaturaId)) rechazar('No tienes acceso a esta asignatura', 403);

  if (anterior) {
    const esAutorEnTiempo = String(anterior.autorId) === String(usuario.id) && dentroDeVentana(anterior);
    if (!esAutorEnTiempo && !puedeModerar(usuario)) {
      rechazar('Solo puedes editar tus publicaciones durante los primeros 15 minutos', 403);
    }
    datos.autorId = anterior.autorId;
    datos.asignaturaId = anterior.asignaturaId;
    datos.ultimoMovimiento = anterior.ultimoMovimiento;
    if (!puedeModerar(usuario)) {
      for (const campo of CAMPOS_MODERACION) {
        if (Object.prototype.hasOwnProperty.call(datos, campo) && datos[campo] !== anterior[campo]) {
          rechazar('Solo docentes y administradores pueden moderar hilos', 403);
        }
      }
    }
  } else {
    datos.autorId = usuario.id;
    datos.fijado = puedeModerar(usuario) ? Boolean(datos.fijado) : false;
    datos.cerrado = puedeModerar(usuario) ? Boolean(datos.cerrado) : false;
    datos.oculto = puedeModerar(usuario) ? Boolean(datos.oculto) : false;
    datos.ultimoMovimiento = new Date().toISOString();
  }

  const titulo = String(combinado.titulo || '').trim();
  const texto = String(combinado.texto || '').trim();
  if (!titulo) rechazar('El título es obligatorio');
  if (titulo.length > 200) rechazar('El título no puede superar 200 caracteres');
  if (!texto) rechazar('El texto es obligatorio');
  if (texto.length > 5000) rechazar('El texto no puede superar 5.000 caracteres');

  if (combinado.temaId) {
    const [tema] = await almacen.buscar('temas', { id: combinado.temaId });
    const [unidad] = tema ? await almacen.buscar('unidades', { id: tema.unidadId }) : [];
    if (!tema || !unidad || String(unidad.asignaturaId) !== String(asignaturaId)) {
      rechazar('El tema no pertenece a la asignatura seleccionada');
    }
  }

  return datos;
}

export async function despuesDeGuardar(registro, usuario, anterior) {
  if (!registro || anterior) return;

  try {
    const distributivo = await almacen.leer('distributivo');
    const destinatarios = new Set();

    for (const g of distributivo || []) {
      if (String(g.asignaturaId) === String(registro.asignaturaId)) {
        docentesIdsDeGrupo(g)
          .filter(docenteId => docenteId !== String(usuario.id))
          .forEach(docenteId => destinatarios.add(docenteId));
        if (Array.isArray(g.estudiantes)) {
          for (const estId of g.estudiantes) {
            if (String(estId) !== String(usuario.id)) {
              destinatarios.add(String(estId));
            }
          }
        }
      }
    }

    for (const destId of destinatarios) {
      await notificar(destId, {
        tipo: 'foro-hilo',
        mensaje: `Nuevo tema en el foro: "${registro.titulo}"`,
        enlace: `/paginas/hilo.html?id=${encodeURIComponent(registro.id)}`
      });
    }
  } catch (err) {
    console.error('Error al notificar nuevo hilo de foro:', err);
  }
}

export default { filtrarLista, antesDeGuardar, despuesDeGuardar };
