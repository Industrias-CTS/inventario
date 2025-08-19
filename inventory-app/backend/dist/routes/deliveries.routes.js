"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const deliveries_controller_1 = require("../controllers/deliveries.controller");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.get('/', deliveries_controller_1.deliveriesController.getDeliveries);
router.get('/:id', deliveries_controller_1.deliveriesController.getDeliveryById);
router.get('/:id/pdf', deliveries_controller_1.deliveriesController.generateDeliveryPDF);
router.post('/', deliveries_controller_1.deliveriesController.createDelivery);
router.put('/:id', deliveries_controller_1.deliveriesController.updateDelivery);
router.delete('/:id', deliveries_controller_1.deliveriesController.deleteDelivery);
exports.default = router;
//# sourceMappingURL=deliveries.routes.js.map