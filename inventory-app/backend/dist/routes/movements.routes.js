"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const movements_controller_1 = require("@/controllers/movements.controller");
const auth_1 = require("@/middlewares/auth");
const validation_1 = require("@/middlewares/validation");
const router = (0, express_1.Router)();
router.get('/', auth_1.authenticate, movements_controller_1.getMovements);
router.post('/', auth_1.authenticate, (0, auth_1.authorize)('admin', 'user'), [
    (0, express_validator_1.body)('movement_type_id').isUUID().withMessage('ID de tipo de movimiento inválido'),
    (0, express_validator_1.body)('component_id').isUUID().withMessage('ID de componente inválido'),
    (0, express_validator_1.body)('quantity').isNumeric().isFloat({ gt: 0 }).withMessage('La cantidad debe ser mayor a 0'),
], validation_1.validateRequest, movements_controller_1.createMovement);
router.get('/reservations', auth_1.authenticate, movements_controller_1.getReservations);
router.post('/reservations', auth_1.authenticate, (0, auth_1.authorize)('admin', 'user'), [
    (0, express_validator_1.body)('component_id').isUUID().withMessage('ID de componente inválido'),
    (0, express_validator_1.body)('quantity').isNumeric().isFloat({ gt: 0 }).withMessage('La cantidad debe ser mayor a 0'),
], validation_1.validateRequest, movements_controller_1.createReservation);
router.post('/invoice', auth_1.authenticate, (0, auth_1.authorize)('admin', 'user'), [
    (0, express_validator_1.body)('movement_type_id').isUUID().withMessage('ID de tipo de movimiento inválido'),
    (0, express_validator_1.body)('reference_number').notEmpty().withMessage('Número de referencia es requerido'),
    (0, express_validator_1.body)('items').isArray({ min: 1 }).withMessage('Debe incluir al menos un item'),
    (0, express_validator_1.body)('items.*.component_code').notEmpty().withMessage('Código de componente es requerido'),
    (0, express_validator_1.body)('items.*.component_name').notEmpty().withMessage('Nombre de componente es requerido'),
    (0, express_validator_1.body)('items.*.quantity').isNumeric().isFloat({ gt: 0 }).withMessage('La cantidad debe ser mayor a 0'),
    (0, express_validator_1.body)('items.*.total_cost').isNumeric().isFloat({ gt: 0 }).withMessage('El costo total debe ser mayor a 0'),
    (0, express_validator_1.body)('shipping_cost').optional().isNumeric().withMessage('El costo de envío debe ser numérico'),
    (0, express_validator_1.body)('shipping_tax').optional().isNumeric().withMessage('Los impuestos de envío deben ser numéricos'),
], validation_1.validateRequest, movements_controller_1.createInvoice);
exports.default = router;
//# sourceMappingURL=movements.routes.js.map