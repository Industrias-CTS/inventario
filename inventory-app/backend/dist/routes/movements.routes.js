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
exports.default = router;
//# sourceMappingURL=movements.routes.js.map