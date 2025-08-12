"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reports_controller_1 = require("../controllers/reports.controller");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación
router.use(auth_1.authenticate);
// GET /api/reports/movements - Reporte de movimientos
router.get('/movements', reports_controller_1.getMovementsReport);
// GET /api/reports/inventory - Reporte de inventario actual
router.get('/inventory', reports_controller_1.getInventoryReport);
// GET /api/reports/component - Reporte de un componente específico
router.get('/component', reports_controller_1.getComponentReport);
exports.default = router;
//# sourceMappingURL=reports.routes.js.map