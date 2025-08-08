import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validation';
import { db } from '../config/database.config';

const router = Router();
const generateId = () => Math.random().toString(36).substr(2, 9);

// GET /api/units - Obtener todas las unidades
router.get('/', async (_req, res) => {
  try {
    const units = await db.query('SELECT * FROM units ORDER BY name');
    res.json({ units });
  } catch (error) {
    console.error('Error al obtener unidades:', error);
    res.status(500).json({ error: 'Error al obtener unidades' });
  }
});

// POST /api/units - Crear unidad
router.post(
  '/',
  authenticate,
  authorize('admin'),
  [
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('symbol').notEmpty().withMessage('El símbolo es requerido')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { name, symbol } = req.body;
      
      // Verificar si ya existe
      const existingName = await db.get('SELECT id FROM units WHERE name = ?', [name]);
      if (existingName) {
        return res.status(400).json({ error: 'Ya existe una unidad con ese nombre' });
      }

      const existingSymbol = await db.get('SELECT id FROM units WHERE symbol = ?', [symbol]);
      if (existingSymbol) {
        return res.status(400).json({ error: 'Ya existe una unidad con ese símbolo' });
      }

      const id = generateId();
      const now = new Date().toISOString();

      await db.run(
        'INSERT INTO units (id, name, symbol, created_at) VALUES (?, ?, ?, ?)',
        [id, name, symbol, now]
      );

      const newUnit = await db.get('SELECT * FROM units WHERE id = ?', [id]);
      
      res.status(201).json({
        message: 'Unidad creada exitosamente',
        unit: newUnit
      });
    } catch (error: any) {
      console.error('Error al crear unidad:', error);
      res.status(500).json({ error: 'Error al crear unidad' });
    }
  }
);

// PUT /api/units/:id - Actualizar unidad
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  [
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('symbol').notEmpty().withMessage('El símbolo es requerido')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, symbol } = req.body;

      const existing = await db.get('SELECT * FROM units WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Unidad no encontrada' });
      }

      // Verificar nombres/símbolos duplicados
      const duplicateName = await db.get('SELECT id FROM units WHERE name = ? AND id != ?', [name, id]);
      if (duplicateName) {
        return res.status(400).json({ error: 'Ya existe una unidad con ese nombre' });
      }

      const duplicateSymbol = await db.get('SELECT id FROM units WHERE symbol = ? AND id != ?', [symbol, id]);
      if (duplicateSymbol) {
        return res.status(400).json({ error: 'Ya existe una unidad con ese símbolo' });
      }

      await db.run(
        'UPDATE units SET name = ?, symbol = ? WHERE id = ?',
        [name, symbol, id]
      );

      const updatedUnit = await db.get('SELECT * FROM units WHERE id = ?', [id]);
      
      res.json({
        message: 'Unidad actualizada exitosamente',
        unit: updatedUnit
      });
    } catch (error) {
      console.error('Error al actualizar unidad:', error);
      res.status(500).json({ error: 'Error al actualizar unidad' });
    }
  }
);

// DELETE /api/units/:id - Eliminar unidad
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const existing = await db.get('SELECT * FROM units WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Unidad no encontrada' });
      }

      // Verificar si hay componentes usando esta unidad
      const componentsCount = await db.get('SELECT COUNT(*) as count FROM components WHERE unit_id = ?', [id]);
      if (componentsCount.count > 0) {
        return res.status(400).json({ 
          error: 'No se puede eliminar la unidad porque hay componentes que la usan' 
        });
      }

      await db.run('DELETE FROM units WHERE id = ?', [id]);
      
      res.json({ message: 'Unidad eliminada exitosamente' });
    } catch (error) {
      console.error('Error al eliminar unidad:', error);
      res.status(500).json({ error: 'Error al eliminar unidad' });
    }
  }
);

export default router;