// servidor/rutas/subidas.js · Subida de archivos con multer según rol y ajustes
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { exigirRol } from '../auth.js';
import { leerConfig } from '../almacen.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CARPETA_SUBIDAS = path.resolve(__dirname, '../../publico/recursos/subidas');

// Asegurar existencia del directorio de destino
await fs.mkdir(CARPETA_SUBIDAS, { recursive: true });

const MIMES_IMAGENES = ['image/jpeg', 'image/png', 'image/webp'];
const EXTENSIONES_IMAGENES = ['.jpg', '.jpeg', '.png', '.webp'];

const MIMES_DOCENTE_ADMIN = [
  ...MIMES_IMAGENES,
  'application/pdf',
  'audio/mpeg',
  'audio/mp3'
];
const EXTENSIONES_DOCENTE_ADMIN = [
  ...EXTENSIONES_IMAGENES,
  '.pdf',
  '.mp3'
];

const almacenamiento = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, CARPETA_SUBIDAS);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const nombreAleatorio = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, nombreAleatorio);
  }
});

const filtroArchivos = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const rol = req.usuario ? req.usuario.rol : 'estudiante';
  const esDocenteOAdmin = rol === 'docente' || rol === 'admin';

  const mimesPermitidos = esDocenteOAdmin ? MIMES_DOCENTE_ADMIN : MIMES_IMAGENES;
  const extPermitidas = esDocenteOAdmin ? EXTENSIONES_DOCENTE_ADMIN : EXTENSIONES_IMAGENES;

  if (mimesPermitidos.includes(file.mimetype) && extPermitidas.includes(ext)) {
    cb(null, true);
  } else {
    const mensaje = esDocenteOAdmin
      ? 'Solo se permiten imágenes (JPG, PNG, WEBP), documentos PDF o audios MP3'
      : 'Solo se permiten imágenes en formato JPG, PNG o WEBP';
    const err = new Error(mensaje);
    err.codigo = 'TIPO_INVALIDO';
    cb(err, false);
  }
};

const router = express.Router();

router.post('/subidas', exigirRol(), async (req, res, next) => {
  try {
    const ajustes = await leerConfig('ajustes');
    const rol = req.usuario ? req.usuario.rol : 'estudiante';
    const esDocenteOAdmin = rol === 'docente' || rol === 'admin';

    const maxMB = esDocenteOAdmin ? (ajustes.maxSubidaMB || 10) : 2;
    const limiteBytes = maxMB * 1024 * 1024;

    const subida = multer({
      storage: almacenamiento,
      limits: {
        fileSize: limiteBytes
      },
      fileFilter: filtroArchivos
    }).single('archivo');

    subida(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: `El archivo excede el límite máximo permitido de ${maxMB} MB` });
        }
        return res.status(400).json({ error: err.message || 'Error al procesar el archivo' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No se ha proporcionado ningún archivo' });
      }

      const url = `/recursos/subidas/${req.file.filename}`;
      res.json({ url });
    });
  } catch (err) {
    next(err);
  }
});

export default router;
