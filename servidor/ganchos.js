// servidor/ganchos.js · Registro y ejecución de ganchos por colección
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GANCHOS_DIR = path.join(__dirname, 'ganchos');

const ganchosRegistrados = new Map();

export async function cargarGanchos() {
  ganchosRegistrados.clear();
  try {
    await fs.mkdir(GANCHOS_DIR, { recursive: true });
    const archivos = await fs.readdir(GANCHOS_DIR);
    const archivosJs = archivos.filter(a => a.endsWith('.js'));

    for (const archivo of archivosJs) {
      const coleccion = archivo.replace(/\.js$/, '');
      const rutaCompleta = path.join(GANCHOS_DIR, archivo);
      const urlModulo = pathToFileURL(rutaCompleta).href;
      const modulo = await import(urlModulo);
      ganchosRegistrados.set(coleccion, modulo.default || modulo);
    }
  } catch (err) {
    console.error('Error al cargar ganchos:', err);
  }
}

// Carga automática de ganchos al iniciar
await cargarGanchos();

export async function aplicar(col, nombre, ...args) {
  const coleccionBase = typeof col === 'string' && col.includes('/') ? col.split('/')[0] : col;
  const ganchoCol = ganchosRegistrados.get(col) || ganchosRegistrados.get(coleccionBase);

  if (!ganchoCol || typeof ganchoCol[nombre] !== 'function') {
    return args[0];
  }

  return await ganchoCol[nombre](...args);
}
