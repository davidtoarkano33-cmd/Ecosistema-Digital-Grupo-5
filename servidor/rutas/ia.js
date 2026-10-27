// servidor/rutas/ia.js · Rutas de invocación y prueba del servicio de IA
import { Router } from 'express';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs/promises';
import { ejecutarTarea, obtenerConfigIA, guardarConfigIA, probarConexionApi, listarModelosIA } from '../ia.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PREPARADORES_DIR = path.join(__dirname, '..', 'preparadores');

const router = Router();

// GET /ia/modelos (solo admin) → retorna la lista de modelos de Gemini soportados o en vivo
router.get('/ia/modelos', async (req, res) => {
  try {
    const usuario = req.usuario;
    if (!usuario) {
      return res.status(401).json({ error: 'Sesión no iniciada' });
    }
    if (usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Acceso exclusivo para administradores' });
    }

    const modelos = await listarModelosIA();
    return res.json({ ok: true, modelos });
  } catch (err) {
    console.error('Error en GET /ia/modelos:', err);
    return res.status(500).json({ error: err.message || 'Error al listar modelos de IA' });
  }
});

// GET /ia/config (solo admin) → retorna la configuración activa sin exponer la clave completa
router.get('/ia/config', async (req, res) => {
  try {
    const usuario = req.usuario;
    if (!usuario) {
      return res.status(401).json({ error: 'Sesión no iniciada' });
    }
    if (usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Acceso exclusivo para administradores' });
    }

    const config = await obtenerConfigIA();
    return res.json({
      proveedor: config.proveedor,
      modelo: config.modelo,
      tieneClave: config.tieneClave,
      claveEnmascarada: config.claveEnmascarada
    });
  } catch (err) {
    console.error('Error en GET /ia/config:', err);
    return res.status(500).json({ error: err.message || 'Error al obtener configuración de IA' });
  }
});

// POST /ia/config (solo admin) → guarda ajustes públicos y la clave privada en .env
router.post('/ia/config', async (req, res) => {
  try {
    const usuario = req.usuario;
    if (!usuario) {
      return res.status(401).json({ error: 'Sesión no iniciada' });
    }
    if (usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Acceso exclusivo para administradores' });
    }

    const { proveedor, modelo, clave } = req.body || {};
    const resultado = await guardarConfigIA({ proveedor, modelo, clave });
    return res.json({
      ok: true,
      mensaje: 'Configuración de IA guardada correctamente',
      ...resultado
    });
  } catch (err) {
    console.error('Error en POST /ia/config:', err);
    return res.status(500).json({ error: err.message || 'Error al guardar configuración de IA' });
  }
});

// POST /ia/probar-conexion (solo admin) → realiza prueba directa con el proveedor
router.post('/ia/probar-conexion', async (req, res) => {
  try {
    const usuario = req.usuario;
    if (!usuario) {
      return res.status(401).json({ error: 'Sesión no iniciada' });
    }
    if (usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Acceso exclusivo para administradores' });
    }

    const { proveedor, modelo, clave } = req.body || {};
    const resultado = await probarConexionApi({ proveedor, modelo, clave });
    return res.json(resultado);
  } catch (err) {
    console.error('Error en POST /ia/probar-conexion:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Error en prueba de conexión' });
  }
});

// GET /ia/prueba (solo admin) → envía prueba de conexión y responde "OK"
router.get('/ia/prueba', async (req, res) => {
  try {
    const usuario = req.usuario;
    if (!usuario) {
      return res.status(401).json({ error: 'Sesión no iniciada' });
    }

    if (usuario.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden realizar la prueba de IA' });
    }

    const resultado = await ejecutarTarea('prueba', {}, usuario, { formato: 'texto' });
    return res.json({ ok: true, resultado });
  } catch (err) {
    console.error('Error en GET /ia/prueba:', err);
    return res.status(err.estado || 500).json({ error: err.message || 'Error en prueba de IA' });
  }
});

// POST /ia/:tarea (con sesión)
router.post('/ia/:tarea', async (req, res) => {
  try {
    const usuario = req.usuario;
    if (!usuario) {
      return res.status(401).json({ error: 'Sesión no iniciada' });
    }

    const { tarea } = req.params;

    // Control de roles según tipo de tarea
    const esGeneracion = tarea.startsWith('generar-');
    if (esGeneracion) {
      if (usuario.rol !== 'docente' && usuario.rol !== 'admin') {
        return res.status(403).json({ error: 'Solo docentes o administradores pueden generar contenido con IA' });
      }
    } else {
      // tutor, rol-simulacion, evaluar-rol requieren sesión activa (ya validado)
      const tareasPermitidas = ['tutor', 'rol-simulacion', 'evaluar-rol'];
      if (!tareasPermitidas.includes(tarea)) {
        return res.status(404).json({ error: `Tarea de IA "${tarea}" no reconocida` });
      }
    }

    // Verificar si existe el preparador en servidor/preparadores/<tarea>.js
    const rutaPreparador = path.join(PREPARADORES_DIR, `${tarea}.js`);
    try {
      await fs.access(rutaPreparador);
    } catch {
      return res.status(404).json({ error: `Preparador para la tarea "${tarea}" no encontrado` });
    }

    // Cargar dinámicamente el preparador
    const urlModulo = pathToFileURL(rutaPreparador).href;
    const modulo = await import(urlModulo);
    const preparar = modulo.default || modulo;

    if (typeof preparar !== 'function') {
      return res.status(500).json({ error: `El preparador para "${tarea}" no exporta una función válida` });
    }

    // El navegador nunca envía instrucciones, solo datos
    const datosPrompt = await preparar(req.body, usuario);

    // Formato de salida: json en generar-* y evaluar-rol; texto en tutor y rol-simulacion
    const formato = (esGeneracion || tarea === 'evaluar-rol') ? 'json' : 'texto';

    const resultado = await ejecutarTarea(tarea, datosPrompt, usuario, { formato });

    return res.json(resultado);
  } catch (err) {
    console.error(`Error en POST /ia/${req.params?.tarea}:`, err);
    return res.status(err.estado || 500).json({ error: err.message || 'Error al procesar tarea de IA' });
  }
});

export default router;
