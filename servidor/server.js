// servidor/server.js · Servidor base Express y API genérica
import express from 'express';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as almacen from './almacen.js';
import { puede } from './permisos.js';
import * as ganchos from './ganchos.js';
import { cargarUsuario } from './auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RUTA_RAIZ = path.resolve(__dirname, '..');
const PUBLICO_DIR = path.join(RUTA_RAIZ, 'publico');
const RUTAS_DIR = path.join(__dirname, 'rutas');

const app = express();

// Servir archivos estáticos del navegador
app.use(express.static(PUBLICO_DIR));

// Parseo de JSON con límite de 1 MB
app.use(express.json({ limit: '1mb' }));

// Middleware de autenticación y carga de usuario
app.use(cargarUsuario);

// Montar automáticamente rutas personalizadas de servidor/rutas/*.js en /api en orden alfabético
async function montarRutasPersonalizadas(servidorApp) {
  try {
    await fs.mkdir(RUTAS_DIR, { recursive: true });
    const archivos = await fs.readdir(RUTAS_DIR);
    const archivosJs = archivos.filter(a => a.endsWith('.js')).sort();

    for (const archivo of archivosJs) {
      const rutaArchivo = path.join(RUTAS_DIR, archivo);
      const urlModulo = pathToFileURL(rutaArchivo).href;
      const modulo = await import(urlModulo);
      const router = modulo.default || modulo;
      servidorApp.use('/api', router);
    }
  } catch (err) {
    console.error('Error al montar rutas personalizadas:', err);
  }
}

await montarRutasPersonalizadas(app);

// API genérica: /api/:col y /api/:col/:id
app.get('/api/:col', async (req, res, next) => {
  try {
    const { col } = req.params;
    const permitido = await puede(req.usuario, 'leer', col);
    if (!permitido) {
      return res.status(req.usuario ? 403 : 401).json({ error: 'Acceso no permitido' });
    }

    let lista = await almacen.buscar(col, req.query);
    lista = await ganchos.aplicar(col, 'filtrarLista', lista, req.usuario);
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

app.get('/api/:col/:id', async (req, res, next) => {
  try {
    const { col, id } = req.params;
    const registros = await almacen.buscar(col, { id });
    const item = registros[0];

    if (!item) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const permitido = await puede(req.usuario, 'leer', col, item);
    if (!permitido) {
      return res.status(req.usuario ? 403 : 401).json({ error: 'Acceso no permitido' });
    }

    res.json(item);
  } catch (err) {
    next(err);
  }
});

app.post('/api/:col', async (req, res, next) => {
  try {
    const { col } = req.params;
    let datos = req.body;

    const permitido = await puede(req.usuario, 'escribir', col, datos);
    if (!permitido) {
      return res.status(req.usuario ? 403 : 401).json({ error: 'Acceso no permitido' });
    }

    datos = await ganchos.aplicar(col, 'antesDeGuardar', datos, req.usuario, null);
    const nuevo = await almacen.agregar(col, datos);
    await ganchos.aplicar(col, 'despuesDeGuardar', nuevo, req.usuario, null);

    res.status(201).json(nuevo);
  } catch (err) {
    next(err);
  }
});

app.put('/api/:col/:id', async (req, res, next) => {
  try {
    const { col, id } = req.params;
    const registros = await almacen.buscar(col, { id });
    const anterior = registros[0];

    if (!anterior) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const permitido = await puede(req.usuario, 'escribir', col, anterior);
    if (!permitido) {
      return res.status(req.usuario ? 403 : 401).json({ error: 'Acceso no permitido' });
    }

    let cambios = req.body;
    cambios = await ganchos.aplicar(col, 'antesDeGuardar', cambios, req.usuario, anterior);
    const actualizado = await almacen.actualizar(col, id, cambios);
    await ganchos.aplicar(col, 'despuesDeGuardar', actualizado, req.usuario, anterior);

    res.json(actualizado);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/:col/:id', async (req, res, next) => {
  try {
    const { col, id } = req.params;
    const registros = await almacen.buscar(col, { id });
    const anterior = registros[0];

    if (!anterior) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const permitido = await puede(req.usuario, 'escribir', col, anterior);
    if (!permitido) {
      return res.status(req.usuario ? 403 : 401).json({ error: 'Acceso no permitido' });
    }

    const eliminado = await almacen.eliminar(col, id);
    res.json({ ok: true, eliminado });
  } catch (err) {
    next(err);
  }
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  const estado = typeof err.estado === 'number' ? err.estado : (typeof err.status === 'number' ? err.status : 500);
  res.status(estado).json({ error: err.message || 'Error interno del servidor' });
});

const PUERTO = process.env.PORT || process.env.PUERTO || 3000;
const servidor = app.listen(PUERTO, () => {
  console.log(`Servidor activo en el puerto ${PUERTO}`);
});

export { app, servidor };
export default app;
