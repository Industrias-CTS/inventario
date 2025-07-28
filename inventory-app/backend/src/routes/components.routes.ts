import { Router } from 'express';
import { body } from 'express-validator';
import {
  getComponents,
  getComponentById,
  createComponent,
  updateComponent,
  deleteComponent,
  getComponentStock
} from '@/controllers/components.controller';
import { authenticate, authorize } from '@/middlewares/auth';
import { validateRequest } from '@/middlewares/validation';

const router = Router();

router.get('/', authenticate, getComponents);
router.get('/:id', authenticate, getComponentById);
router.get('/:id/stock', authenticate, getComponentStock);

router.post(
  '/',
  authenticate,
  authorize('admin', 'user'),
  [
    body('code').notEmpty().withMessage('El código es requerido'),
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('unit_id').isUUID().withMessage('ID de unidad inválido'),
    body('min_stock').isNumeric().withMessage('Stock mínimo debe ser numérico'),
    body('cost_price').isNumeric().withMessage('Precio de costo debe ser numérico'),
  ],
  validateRequest,
  createComponent
);

router.put(
  '/:id',
  authenticate,
  authorize('admin', 'user'),
  updateComponent
);

router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  deleteComponent
);

export default router;