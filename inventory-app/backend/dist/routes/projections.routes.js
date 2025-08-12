"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const projections_controller_1 = require("../controllers/projections.controller");
const auth_1 = require("../middlewares/auth");
const validation_1 = require("../middlewares/validation");
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación
router.use(auth_1.authenticate);
// GET /api/projections - Obtener todas las proyecciones
router.get('/', projections_controller_1.getProjections);
// GET /api/projections/:id - Obtener una proyección por ID
router.get('/:id', projections_controller_1.getProjectionById);
// POST /api/projections - Crear nueva proyección
router.post('/', (0, auth_1.authorize)('admin', 'user'), [
    (0, express_validator_1.body)('name').notEmpty().withMessage('El nombre es requerido'),
    (0, express_validator_1.body)('recipes').isArray({ min: 1 }).withMessage('Debe incluir al menos una receta'),
    (0, express_validator_1.body)('recipes.*.recipe_id').notEmpty().withMessage('ID de receta es requerido'),
    (0, express_validator_1.body)('recipes.*.quantity').isNumeric().isFloat({ gt: 0 }).withMessage('La cantidad debe ser mayor a 0'),
], validation_1.validateRequest, projections_controller_1.createProjection);
// PUT /api/projections/:id - Actualizar proyección
router.put('/:id', (0, auth_1.authorize)('admin', 'user'), [
    (0, express_validator_1.body)('name').notEmpty().withMessage('El nombre es requerido'),
    (0, express_validator_1.body)('recipes').optional().isArray().withMessage('Recetas debe ser un array'),
    (0, express_validator_1.body)('recipes.*.recipe_id').optional().notEmpty().withMessage('ID de receta es requerido'),
    (0, express_validator_1.body)('recipes.*.quantity').optional().isNumeric().isFloat({ gt: 0 }).withMessage('La cantidad debe ser mayor a 0'),
], validation_1.validateRequest, projections_controller_1.updateProjection);
// DELETE /api/projections/:id - Eliminar proyección
router.delete('/:id', (0, auth_1.authorize)('admin', 'user'), projections_controller_1.deleteProjection);
exports.default = router;
//# sourceMappingURL=projections.routes.js.map