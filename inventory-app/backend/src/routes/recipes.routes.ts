import { Router } from 'express';
import { body } from 'express-validator';
import {
  getRecipes,
  getRecipeById,
  createRecipe,
  updateRecipe,
  deleteRecipe
} from '@/controllers/recipes.controller';
import { authenticate, authorize } from '@/middlewares/auth';
import { validateRequest } from '@/middlewares/validation';

const router = Router();

router.get('/', authenticate, getRecipes);
router.get('/:id', authenticate, getRecipeById);

router.post(
  '/',
  authenticate,
  authorize('admin', 'user'),
  [
    body('code').notEmpty().withMessage('El código es requerido'),
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('output_component_id').isUUID().withMessage('ID de componente de salida inválido'),
    body('output_quantity').isNumeric().withMessage('Cantidad de salida debe ser numérica'),
    body('ingredients').isArray().withMessage('Los ingredientes deben ser un array'),
    body('ingredients.*.component_id').isUUID().withMessage('ID de componente ingrediente inválido'),
    body('ingredients.*.quantity').isNumeric().withMessage('Cantidad de ingrediente debe ser numérica'),
  ],
  validateRequest,
  createRecipe
);

router.put(
  '/:id',
  authenticate,
  authorize('admin', 'user'),
  [
    body('code').notEmpty().withMessage('El código es requerido'),
    body('name').notEmpty().withMessage('El nombre es requerido'),
    body('output_component_id').isUUID().withMessage('ID de componente de salida inválido'),
    body('output_quantity').isNumeric().withMessage('Cantidad de salida debe ser numérica'),
    body('ingredients').isArray().withMessage('Los ingredientes deben ser un array'),
    body('ingredients.*.component_id').isUUID().withMessage('ID de componente ingrediente inválido'),
    body('ingredients.*.quantity').isNumeric().withMessage('Cantidad de ingrediente debe ser numérica'),
  ],
  validateRequest,
  updateRecipe
);

router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  deleteRecipe
);

export default router;