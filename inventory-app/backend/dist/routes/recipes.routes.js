"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const recipes_controller_1 = require("../controllers/recipes.controller");
const auth_1 = require("../middlewares/auth");
const validation_1 = require("../middlewares/validation");
const router = (0, express_1.Router)();
router.get('/', auth_1.authenticate, recipes_controller_1.getRecipes);
router.get('/:id', auth_1.authenticate, recipes_controller_1.getRecipeById);
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('admin', 'user'), [
    (0, express_validator_1.body)('code').notEmpty().withMessage('El código es requerido'),
    (0, express_validator_1.body)('name').notEmpty().withMessage('El nombre es requerido'),
    (0, express_validator_1.body)('output_component_id').isUUID().withMessage('ID de componente de salida inválido'),
    (0, express_validator_1.body)('output_quantity').isNumeric().withMessage('Cantidad de salida debe ser numérica'),
    (0, express_validator_1.body)('ingredients').isArray().withMessage('Los ingredientes deben ser un array'),
    (0, express_validator_1.body)('ingredients.*.component_id').isUUID().withMessage('ID de componente ingrediente inválido'),
    (0, express_validator_1.body)('ingredients.*.quantity').isNumeric().withMessage('Cantidad de ingrediente debe ser numérica'),
], validation_1.validateRequest, recipes_controller_1.createRecipe);
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)('admin', 'user'), [
    (0, express_validator_1.body)('code').notEmpty().withMessage('El código es requerido'),
    (0, express_validator_1.body)('name').notEmpty().withMessage('El nombre es requerido'),
    (0, express_validator_1.body)('output_component_id').isUUID().withMessage('ID de componente de salida inválido'),
    (0, express_validator_1.body)('output_quantity').isNumeric().withMessage('Cantidad de salida debe ser numérica'),
    (0, express_validator_1.body)('ingredients').isArray().withMessage('Los ingredientes deben ser un array'),
    (0, express_validator_1.body)('ingredients.*.component_id').isUUID().withMessage('ID de componente ingrediente inválido'),
    (0, express_validator_1.body)('ingredients.*.quantity').isNumeric().withMessage('Cantidad de ingrediente debe ser numérica'),
], validation_1.validateRequest, recipes_controller_1.updateRecipe);
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)('admin'), recipes_controller_1.deleteRecipe);
exports.default = router;
//# sourceMappingURL=recipes.routes.js.map