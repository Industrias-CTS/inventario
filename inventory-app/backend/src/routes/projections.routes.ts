import { Router } from 'express';
import { body } from 'express-validator';
import {
  getProjections,
  getProjectionById,
  createProjection,
  updateProjection,
  deleteProjection
} from '../controllers/projections.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validation';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// GET /api/projections - Obtener todas las proyecciones
router.get('/', getProjections);

// GET /api/projections/:id - Obtener una proyección por ID
router.get('/:id', getProjectionById);

// POST /api/projections - Crear nueva proyección
router.post(
  '/',
  authorize('admin', 'user'),
  [
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('recipes').isArray({ min: 1 }).withMessage('Debe incluir al menos una receta'),
    body('recipes.*.recipe_id').notEmpty().withMessage('ID de receta es requerido'),
    body('recipes.*.quantity').isNumeric().isFloat({ gt: 0 }).withMessage('La cantidad debe ser mayor a 0'),
  ],
  validateRequest,
  createProjection
);

// PUT /api/projections/:id - Actualizar proyección
router.put(
  '/:id',
  authorize('admin', 'user'),
  [
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('recipes').optional().isArray().withMessage('Recetas debe ser un array'),
    body('recipes.*.recipe_id').optional().notEmpty().withMessage('ID de receta es requerido'),
    body('recipes.*.quantity').optional().isNumeric().isFloat({ gt: 0 }).withMessage('La cantidad debe ser mayor a 0'),
  ],
  validateRequest,
  updateProjection
);

// DELETE /api/projections/:id - Eliminar proyección
router.delete(
  '/:id',
  authorize('admin', 'user'),
  deleteProjection
);

export default router;