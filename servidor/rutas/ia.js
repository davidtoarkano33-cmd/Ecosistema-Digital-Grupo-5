// servidor/rutas/ia.js · Rutas de invocación y prueba del servicio de IA
import { Router } from 'express';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs/promises';
import { ejecutarTarea } from '../ia.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PREPARADORES_DIR = path.join(__dirname, '..', 'preparadores');

const router = Router();

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
