import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, getProfile } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validation';

const router = Router();

router.post(
  '/register',
  [
    body('username').isLength({ min: 3 }).withMessage('El username debe tener al menos 3 caracteres'),
    body('email').isEmail().withMessage('Email inválido'),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('first_name').notEmpty().withMessage('El nombre es requerido'),
    body('last_name').notEmpty().withMessage('El apellido es requerido'),
  ],
  validateRequest,
  register
);

router.post(
  '/login',
  [
    body('username').notEmpty().withMessage('Username o email requerido'),
    body('password').notEmpty().withMessage('Contraseña requerida'),
  ],
  validateRequest,
  login
);

router.get('/profile', authenticate, getProfile);

export default router;