// servidor/rutas/foros.js · Lectura individual con el filtrado de los ganchos
import { Router } from 'express';
import * as almacen from '../almacen.js';
import * as ganchos from '../ganchos.js';

const router = Router();

async function responderRegistro(req, res, next, coleccion) {
  try {
    if (!req.usuario) return res.status(401).json({ error: 'Sesión requerida' });
    const encontrados = await almacen.buscar(coleccion, { id: req.params.id });
    const visibles = await ganchos.aplicar(coleccion, 'filtrarLista', encontrados, req.usuario);
    if (!visibles.length) return res.status(404).json({ error: 'Publicación no encontrada' });
    res.json(visibles[0]);
  } catch (error) {
    next(error);
  }
}

router.get('/foros-hilos/:id', (req, res, next) => responderRegistro(req, res, next, 'foros-hilos'));
router.get('/foros-respuestas/:id', (req, res, next) => responderRegistro(req, res, next, 'foros-respuestas'));

// Las publicaciones se conservan para auditoría; la moderación usa los campos de visibilidad.
router.delete('/foros-hilos/:id', (req, res) => res.status(405).json({ error: 'Los hilos no se eliminan; pueden ocultarse' }));
router.delete('/foros-respuestas/:id', (req, res) => res.status(405).json({ error: 'Las respuestas no se eliminan; pueden ocultarse' }));
router.delete('/reportes/:id', (req, res) => res.status(405).json({ error: 'Los reportes se conservan y se resuelven' }));

export default router;
