"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const components_controller_1 = require("../controllers/components.controller");
const auth_1 = require("../middlewares/auth");
const validation_1 = require("../middlewares/validation");
const router = (0, express_1.Router)();
router.get('/', auth_1.authenticate, components_controller_1.getComponents);
router.get('/:id', auth_1.authenticate, components_controller_1.getComponentById);
router.get('/:id/stock', auth_1.authenticate, components_controller_1.getComponentStock);
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('admin', 'user'), [
    (0, express_validator_1.body)('code').notEmpty().withMessage('El código es requerido'),
    (0, express_validator_1.body)('name').notEmpty().withMessage('El nombre es requerido'),
    (0, express_validator_1.body)('unit_id').notEmpty().withMessage('ID de unidad es requerido'),
    (0, express_validator_1.body)('category_id').optional(),
    (0, express_validator_1.body)('min_stock').optional().isNumeric().withMessage('Stock mínimo debe ser numérico'),
    (0, express_validator_1.body)('max_stock').optional().isNumeric().withMessage('Stock máximo debe ser numérico'),
    (0, express_validator_1.body)('cost_price').optional().isNumeric().withMessage('Precio de costo debe ser numérico'),
    (0, express_validator_1.body)('sale_price').optional().isNumeric().withMessage('Precio de venta debe ser numérico'),
], validation_1.validateRequest, components_controller_1.createComponent);
router.put('/:id', auth_1.authenticate, (0, auth_1.authorize)('admin', 'user'), components_controller_1.updateComponent);
router.delete('/:id', auth_1.authenticate, (0, auth_1.authorize)('admin'), components_controller_1.deleteComponent);
exports.default = router;
//# sourceMappingURL=components.routes.js.map