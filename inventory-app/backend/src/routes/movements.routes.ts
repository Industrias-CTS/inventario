import { Router } from 'express';
import { body } from 'express-validator';
import {
  getMovements,
  createMovement,
  createReservation,
  getReservations,
  createInvoice
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
    body('type').notEmpty().withMessage('Tipo de movimiento es requerido').isIn(['entrada', 'salida', 'reserva', 'liberacion']).withMessage('Tipo de movimiento no válido'),
    body('component_id').notEmpty().withMessage('ID de componente es requerido'),
    body('quantity').isNumeric().isFloat({ gt: 0 }).withMessage('La cantidad debe ser mayor a 0'),
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
    body('movement_type_id').notEmpty().withMessage('ID de tipo de movimiento es requerido'),
    body('reference_number').notEmpty().withMessage('Número de referencia es requerido'),
    body('items').isArray({ min: 1 }).withMessage('Debe incluir al menos un item'),
    body('items.*.component_code').notEmpty().withMessage('Código de componente es requerido'),
    body('items.*.component_name').notEmpty().withMessage('Nombre de componente es requerido'),
    body('items.*.quantity').isNumeric().isFloat({ gt: 0 }).withMessage('La cantidad debe ser mayor a 0'),
    body('items.*.total_cost').isNumeric().isFloat({ gt: 0 }).withMessage('El costo total debe ser mayor a 0'),
    body('shipping_cost').optional().isNumeric().withMessage('El costo de envío debe ser numérico'),
    body('shipping_tax').optional().isNumeric().withMessage('Los impuestos de envío deben ser numéricos'),
  ],
  validateRequest,
  createInvoice
);

export default router;