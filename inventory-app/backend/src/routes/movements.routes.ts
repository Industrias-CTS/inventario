import { Router } from 'express';
import { body } from 'express-validator';
import {
  getMovements,
  createMovement,
  createInvoice,
  createBulkMovements,
  clearAllMovements
} from '@/controllers/movements.controller';
import { authenticate, authorize } from '@/middlewares/auth';
import { validateRequest } from '@/middlewares/validation';

const router = Router();

router.get('/', authenticate, getMovements);

router.post(
  '/',
  authenticate,
  authorize('admin', 'user'),
  [
    body('component_id').notEmpty().withMessage('ID de componente es requerido'),
    body('quantity').isNumeric().isFloat({ gt: 0 }).withMessage('La cantidad debe ser mayor a 0'),
    body().custom((_, { req }) => {
      if (!req.body.type) {
        throw new Error('type es requerido');
      }
      if (!['entrada', 'salida'].includes(req.body.type)) {
        throw new Error('Tipo de movimiento no válido. Valores permitidos: entrada, salida');
      }
      return true;
    }),
  ],
  validateRequest,
  createMovement
);

router.post(
  '/invoice',
  authenticate,
  authorize('admin', 'user'),
  [
    body('reference_number').notEmpty().withMessage('Número de referencia es requerido'),
    body('items').isArray({ min: 1 }).withMessage('Debe incluir al menos un item'),
    body('items.*.component_code').notEmpty().withMessage('Código de componente es requerido'),
    body('items.*.component_name').notEmpty().withMessage('Nombre de componente es requerido'),
    body('items.*.quantity').isNumeric().isFloat({ gt: 0 }).withMessage('La cantidad debe ser mayor a 0'),
    body('items.*.total_cost').isNumeric().isFloat({ gt: 0 }).withMessage('El costo total debe ser mayor a 0'),
    body('shipping_cost').optional().isNumeric().withMessage('El costo de envío debe ser numérico'),
    body('shipping_tax').optional().isNumeric().withMessage('Los impuestos de envío deben ser numéricos'),
    body().custom((_, { req }) => {
      if (req.body.type && !['entrada', 'salida'].includes(req.body.type)) {
        throw new Error('Tipo de movimiento no válido');
      }
      return true;
    }),
  ],
  validateRequest,
  createInvoice
);

router.post(
  '/bulk',
  authenticate,
  authorize('admin', 'user'),
  [
    body('type').notEmpty().isIn(['entrada', 'salida']).withMessage('Tipo inválido'),
    body('items').isArray({ min: 1 }).withMessage('Debe incluir al menos un item'),
  ],
  validateRequest,
  createBulkMovements
);

router.delete(
  '/clear-all',
  authenticate,
  authorize('admin'),
  clearAllMovements
);

export default router;
