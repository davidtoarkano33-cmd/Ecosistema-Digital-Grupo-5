// servidor/semilla.js · Script de inicialización de datos de prueba (semilla)
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RUTA_RAIZ = path.resolve(__dirname, '..');
const SEMILLA_DIR = path.join(RUTA_RAIZ, 'datos', 'semilla');
const DATOS_DIR = path.join(RUTA_RAIZ, 'datos');
const CLAVE_DEFECTO = 'Demo12345';

async function archivoExiste(ruta) {
  try {
    await fs.access(ruta);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const argumentos = process.argv.slice(2);
  const esForzar = argumentos.includes('--forzar');

  if (esForzar) {
    const rl = readline.createInterface({ input, output });
    try {
      const respuesta = (await rl.question('ATENCIÓN: --forzar reemplazará las colecciones existentes en datos/. ¿Continuar? (s/n): ')).trim().toLowerCase();
      if (respuesta !== 's' && respuesta !== 'si' && respuesta !== 'y' && respuesta !== 'yes') {
        console.log('Operación cancelada por el usuario.');
        return;
      }
    } finally {
      rl.close();
    }
  }

  await fs.mkdir(DATOS_DIR, { recursive: true });

  const archivos = await fs.readdir(SEMILLA_DIR);
  const archivosJson = archivos.filter(a => a.endsWith('.json'));

  console.log(`\n=== Procesando semilla (${archivosJson.length} archivos) ===\n`);

  for (const archivo of archivosJson) {
    const rutaOrigen = path.join(SEMILLA_DIR, archivo);
    const rutaDestino = path.join(DATOS_DIR, archivo);
    const existe = await archivoExiste(rutaDestino);

    if (existe && !esForzar) {
      console.log(`[-] Omitido: datos/${archivo} ya existe (usa --forzar para sobrescribir).`);
      continue;
    }

    const contenidoRaw = await fs.readFile(rutaOrigen, 'utf-8');
    let lista = JSON.parse(contenidoRaw);

    // Si es usuarios.json, generar claveHash de "Demo12345" para todos
    if (archivo === 'usuarios.json') {
      const claveHash = await bcrypt.hash(CLAVE_DEFECTO, 10);
      lista = lista.map(u => ({
        ...u,
        claveHash
      }));
    }

    await fs.writeFile(rutaDestino, JSON.stringify(lista, null, 2), 'utf-8');
    console.log(`[+] ${existe ? 'Reemplazado (--forzar)' : 'Copiado'}: datos/${archivo} (${lista.length} registros).`);
  }

  console.log('\n=== Proceso de semilla finalizado ===\n');
}

main().catch(err => {
  console.error('Error al ejecutar la semilla:', err);
  process.exit(1);
});
