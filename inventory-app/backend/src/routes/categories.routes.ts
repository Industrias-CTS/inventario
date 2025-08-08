import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validation';
import { db } from '../config/database.config';

const router = Router();
const generateId = () => Math.random().toString(36).substr(2, 9);

// GET /api/categories - Obtener todas las categorías
router.get('/', async (_req, res) => {
  try {
    const categories = await db.query('SELECT * FROM categories ORDER BY name');
    res.json({ categories });
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

// POST /api/categories - Crear categoría
router.post(
  '/',
  authenticate,
  authorize('admin'),
  [
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('description').optional().isString()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { name, description } = req.body;
      
      // Verificar si ya existe
      const existing = await db.get('SELECT id FROM categories WHERE name = ?', [name]);
      if (existing) {
        return res.status(400).json({ error: 'Ya existe una categoría con ese nombre' });
      }

      const id = generateId();
      const now = new Date().toISOString();

      await db.run(
        'INSERT INTO categories (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [id, name, description || '', now, now]
      );

      const newCategory = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
      
      res.status(201).json({
        message: 'Categoría creada exitosamente',
        category: newCategory
      });
    } catch (error: any) {
      console.error('Error al crear categoría:', error);
      res.status(500).json({ error: 'Error al crear categoría' });
    }
  }
);

// PUT /api/categories/:id - Actualizar categoría
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  [
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('description').optional().isString()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      const existing = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Categoría no encontrada' });
      }

      // Verificar nombre duplicado
      const duplicate = await db.get('SELECT id FROM categories WHERE name = ? AND id != ?', [name, id]);
      if (duplicate) {
        return res.status(400).json({ error: 'Ya existe una categoría con ese nombre' });
      }

      const now = new Date().toISOString();

      await db.run(
        'UPDATE categories SET name = ?, description = ?, updated_at = ? WHERE id = ?',
        [name, description || '', now, id]
      );

      const updatedCategory = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
      
      res.json({
        message: 'Categoría actualizada exitosamente',
        category: updatedCategory
      });
    } catch (error) {
      console.error('Error al actualizar categoría:', error);
      res.status(500).json({ error: 'Error al actualizar categoría' });
    }
  }
);

// DELETE /api/categories/:id - Eliminar categoría
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const existing = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
      if (!existing) {
        return res.status(404).json({ error: 'Categoría no encontrada' });
      }

      // Verificar si hay componentes usando esta categoría
      const componentsCount = await db.get('SELECT COUNT(*) as count FROM components WHERE category_id = ?', [id]);
      if (componentsCount.count > 0) {
        return res.status(400).json({ 
          error: 'No se puede eliminar la categoría porque hay componentes que la usan' 
        });
      }

      await db.run('DELETE FROM categories WHERE id = ?', [id]);
      
      res.json({ message: 'Categoría eliminada exitosamente' });
    } catch (error) {
      console.error('Error al eliminar categoría:', error);
      res.status(500).json({ error: 'Error al eliminar categoría' });
    }
  }
);

export default router;