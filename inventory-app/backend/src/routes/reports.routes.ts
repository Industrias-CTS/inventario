import { Router } from 'express';
import {
  getMovementsReport,
  getInventoryReport,
  getComponentReport
} from '../controllers/reports.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// GET /api/reports/movements - Reporte de movimientos
router.get('/movements', getMovementsReport);

// GET /api/reports/inventory - Reporte de inventario actual
router.get('/inventory', getInventoryReport);

// GET /api/reports/component - Reporte de un componente específico
router.get('/component', getComponentReport);

export default router;