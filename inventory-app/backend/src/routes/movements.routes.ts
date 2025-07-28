import { Router } from 'express';
import { body } from 'express-validator';
import {
  getMovements,
  createMovement,
  createReservation,
  getReservations
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
    body('movement_type_id').isUUID().withMessage('ID de tipo de movimiento inválido'),
    body('component_id').isUUID().withMessage('ID de componente inválido'),
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
    body('component_id').isUUID().withMessage('ID de componente inválido'),
    body('quantity').isNumeric().isFloat({ gt: 0 }).withMessage('La cantidad debe ser mayor a 0'),
  ],
  validateRequest,
  createReservation
);

export default router;