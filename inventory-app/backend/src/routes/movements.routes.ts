import { Router } from 'express';
import { body } from 'express-validator';
import {
  getMovements,
  createMovement,
  createReservation,
  getReservations,
  createInvoice,
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
    // Validación flexible - acepta movement_type_id O type
    body().custom((_, { req }) => {
      if (!req.body.movement_type_id && !req.body.type) {
        throw new Error('movement_type_id o type es requerido');
      }
      if (req.body.type && !['entrada', 'salida', 'reserva', 'liberacion', 'ajuste', 'transferencia'].includes(req.body.type)) {
        throw new Error('Tipo de movimiento no válido');
      }
      return true;
    }),
  ],
  validateRequest,
  createMovement
);

router.get('/reservations', authenticate, getReservations);

router.post(
  '/reservations',
  authenticate,
  authorize('admin', 'user'),
  [
    body('component_id').notEmpty().withMessage('ID de componente es requerido'),
    body('quantity').isNumeric().isFloat({ gt: 0 }).withMessage('La cantidad debe ser mayor a 0'),
  ],
  validateRequest,
  createReservation
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
    // Validación flexible para facturas - movement_type_id O type opcional
    body().custom((_, { req }) => {
      if (req.body.type && !['entrada', 'salida', 'reserva', 'liberacion', 'ajuste', 'transferencia'].includes(req.body.type)) {
        throw new Error('Tipo de movimiento no válido');
      }
      return true;
    }),
  ],
  validateRequest,
  createInvoice
);

// Endpoint para limpiar todos los movimientos (solo admin)
router.delete(
  '/clear-all',
  authenticate,
  authorize('admin'),
  clearAllMovements
);

export default router;