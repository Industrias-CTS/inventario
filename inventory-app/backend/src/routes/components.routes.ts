import { Router } from 'express';
import { body } from 'express-validator';
import {
  getComponents,
  getComponentById,
  createComponent,
  updateComponent,
  deleteComponent,
  getComponentStock,
  checkDuplicateCodes,
  validateBulkComponents,
} from '@/controllers/components.controller';
import { authenticate, authorize } from '@/middlewares/auth';
import { validateRequest } from '@/middlewares/validation';

const router = Router();

router.get('/', authenticate, getComponents);
router.get('/check-duplicates', authenticate, authorize('admin'), checkDuplicateCodes);
router.get('/:id', authenticate, getComponentById);
router.get('/:id/stock', authenticate, getComponentStock);

router.post(
  '/validate-bulk',
  authenticate,
  authorize('admin', 'user'),
  [
    body('items').isArray({ min: 1 }).withMessage('items debe ser un arreglo no vacío'),
    body('items.*.code').notEmpty().withMessage('Cada item debe tener un código'),
  ],
  validateRequest,
  validateBulkComponents
);

router.post(
  '/',
  authenticate,
  authorize('admin', 'user'),
  [
    body('code').notEmpty().withMessage('El código es requerido'),
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('unit_id').notEmpty().withMessage('ID de unidad es requerido'),
    body('category_id').optional(),
    body('min_stock').optional().isNumeric().withMessage('Stock mínimo debe ser numérico'),
    body('max_stock').optional().isNumeric().withMessage('Stock máximo debe ser numérico'),
    body('cost_price').optional().isNumeric().withMessage('Precio de costo debe ser numérico'),
    body('sale_price').optional().isNumeric().withMessage('Precio de venta debe ser numérico'),
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