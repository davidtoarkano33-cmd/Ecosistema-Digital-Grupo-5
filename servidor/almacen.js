// servidor/almacen.js · Almacenamiento asíncrono seguro en archivos JSON
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RUTA_RAIZ = path.resolve(__dirname, '..');
const DATOS_DIR = path.join(RUTA_RAIZ, 'datos');

const REGEX_COL = /^[a-z0-9_-]+(?:\/[a-z0-9_-]+)?$/;

function validarNombreColeccion(col) {
  if (typeof col !== 'string' || !REGEX_COL.test(col)) {
    const error = new Error(`Nombre de colección inválido: "${col}"`);
    error.estado = 400;
    throw error;
  }
}

function rutaColeccion(col) {
  validarNombreColeccion(col);
  return path.join(DATOS_DIR, `${col}.json`);
}

// Colas de escritura en memoria por archivo
const colasEscritura = new Map();

function encolarEscritura(rutaArchivo, tarea) {
  const colaActual = colasEscritura.get(rutaArchivo) || Promise.resolve();
  const siguiente = colaActual
    .catch(() => {})
    .then(async () => {
      await asegurarRespaldoDiario();
      return await tarea();
    });

  colasEscritura.set(rutaArchivo, siguiente);
  siguiente.finally(() => {
    if (colasEscritura.get(rutaArchivo) === siguiente) {
      colasEscritura.delete(rutaArchivo);
    }
  });

  return siguiente;
}

// Escritura atómica: primero a .tmp y luego rename
async function escribirAtomico(rutaArchivo, contenido) {
  const dir = path.dirname(rutaArchivo);
  await fs.mkdir(dir, { recursive: true });
  const rutaTmp = `${rutaArchivo}.tmp`;
  await fs.writeFile(rutaTmp, contenido, 'utf-8');
  await fs.rename(rutaTmp, rutaArchivo);
}

// Respaldo diario en la primera escritura del día
let respaldoEnCurso = null;

async function asegurarRespaldoDiario() {
  if (respaldoEnCurso) {
    return respaldoEnCurso;
  }
  respaldoEnCurso = ejecutarRespaldoDiario().finally(() => {
    respaldoEnCurso = null;
  });
  return respaldoEnCurso;
}

async function ejecutarRespaldoDiario() {
  const hoy = new Date().toISOString().slice(0, 10);
  const respaldosDir = path.join(DATOS_DIR, 'respaldos');
  const destinoHoy = path.join(respaldosDir, hoy);

  try {
    await fs.access(destinoHoy);
    return;
  } catch {
    // Si no existe, se procede al respaldo
  }

  try {
    await fs.mkdir(DATOS_DIR, { recursive: true });
    await fs.mkdir(respaldosDir, { recursive: true });

    let entradas = [];
    try {
      entradas = await fs.readdir(DATOS_DIR, { withFileTypes: true });
    } catch {
      return;
    }

    const entradasACopiar = entradas.filter(e => e.name !== 'respaldos');
    if (entradasACopiar.length > 0) {
      await fs.mkdir(destinoHoy, { recursive: true });
      for (const e of entradasACopiar) {
        const origen = path.join(DATOS_DIR, e.name);
        const destino = path.join(destinoHoy, e.name);
        await fs.cp(origen, destino, { recursive: true });
      }
    }

    // Mantener solo los 14 más recientes
    const elementos = await fs.readdir(respaldosDir, { withFileTypes: true });
    const respaldosValidos = elementos
      .filter(item => item.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(item.name))
      .map(item => item.name)
      .sort();

    if (respaldosValidos.length > 14) {
      const aEliminar = respaldosValidos.slice(0, respaldosValidos.length - 14);
      for (const carpeta of aEliminar) {
        await fs.rm(path.join(respaldosDir, carpeta), { recursive: true, force: true });
      }
    }
  } catch (err) {
    console.error('Error al realizar respaldo diario:', err);
  }
}

// Generar id: 3 primeras letras de colección base + "_" + 6 dígitos
function generarId(col, lista) {
  const coleccionBase = col.split('/')[0];
  const letras = coleccionBase.replace(/[^a-z0-9]/g, '');
  const prefijo = letras.slice(0, 3).padEnd(3, 'x');

  let mayorNumero = 0;
  const regexId = new RegExp(`^${prefijo}_(\\d+)$`);

  for (const reg of lista) {
    if (reg && typeof reg.id === 'string') {
      const match = reg.id.match(regexId);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > mayorNumero) {
          mayorNumero = num;
        }
      }
    }
  }

  const siguiente = mayorNumero + 1;
  return `${prefijo}_${String(siguiente).padStart(6, '0')}`;
}

export async function leer(col) {
  const ruta = rutaColeccion(col);
  try {
    const contenido = await fs.readFile(ruta, 'utf-8');
    return JSON.parse(contenido);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

export async function escribir(col, lista) {
  const ruta = rutaColeccion(col);
  return encolarEscritura(ruta, async () => {
    const json = JSON.stringify(lista, null, 2);
    await escribirAtomico(ruta, json);
    return lista;
  });
}

export async function agregar(col, reg) {
  const ruta = rutaColeccion(col);
  return encolarEscritura(ruta, async () => {
    const lista = await leer(col);
    const id = generarId(col, lista);
    const fecha = new Date().toISOString();
    const nuevo = {
      ...reg,
      id,
      fecha
    };
    lista.push(nuevo);
    await escribirAtomico(ruta, JSON.stringify(lista, null, 2));
    return nuevo;
  });
}

export async function actualizar(col, id, cambios = {}) {
  const ruta = rutaColeccion(col);
  return encolarEscritura(ruta, async () => {
    const lista = await leer(col);
    const indice = lista.findIndex(item => item && item.id === id);
    if (indice === -1) {
      const error = new Error(`Registro con id "${id}" no encontrado`);
      error.estado = 404;
      throw error;
    }
    const actualizado = {
      ...lista[indice],
      ...cambios,
      id
    };
    lista[indice] = actualizado;
    await escribirAtomico(ruta, JSON.stringify(lista, null, 2));
    return actualizado;
  });
}

export async function eliminar(col, id) {
  const ruta = rutaColeccion(col);
  return encolarEscritura(ruta, async () => {
    const lista = await leer(col);
    const indice = lista.findIndex(item => item && item.id === id);
    if (indice === -1) {
      const error = new Error(`Registro con id "${id}" no encontrado`);
      error.estado = 404;
      throw error;
    }
    const [eliminado] = lista.splice(indice, 1);
    await escribirAtomico(ruta, JSON.stringify(lista, null, 2));
    return eliminado;
  });
}

export async function buscar(col, filtro = {}) {
  const lista = await leer(col);
  if (!filtro || Object.keys(filtro).length === 0) {
    return lista;
  }
  return lista.filter(item => {
    return Object.entries(filtro).every(([clave, valor]) => {
      if (valor === undefined) return true;
      return String(item[clave]) === String(valor);
    });
  });
}

export async function anexarLinea(archivo, obj) {
  const nombreNormalizado = archivo.endsWith('.jsonl') ? archivo : `${archivo}.jsonl`;
  if (!/^[a-z0-9-]+(?:\/[a-z0-9-]+)?\.jsonl$/.test(nombreNormalizado)) {
    const error = new Error(`Nombre de archivo inválido: "${archivo}"`);
    error.estado = 400;
    throw error;
  }
  const ruta = path.join(DATOS_DIR, nombreNormalizado);
  return encolarEscritura(ruta, async () => {
    await fs.mkdir(path.dirname(ruta), { recursive: true });
    const linea = JSON.stringify(obj) + '\n';
    await fs.appendFile(ruta, linea, 'utf-8');
    return true;
  });
}

export async function leerLineas(archivo) {
  const nombreNormalizado = archivo.endsWith('.jsonl') ? archivo : `${archivo}.jsonl`;
  const ruta = path.join(DATOS_DIR, nombreNormalizado);
  try {
    const contenido = await fs.readFile(ruta, 'utf-8');
    return contenido
      .split('\n')
      .map(linea => linea.trim())
      .filter(Boolean)
      .map(linea => JSON.parse(linea));
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

export async function leerConfig(nombre) {
  const nombreNormalizado = nombre.endsWith('.json') ? nombre : `${nombre}.json`;
  const ruta = path.join(DATOS_DIR, 'config', nombreNormalizado);
  try {
    const contenido = await fs.readFile(ruta, 'utf-8');
    return JSON.parse(contenido);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}
