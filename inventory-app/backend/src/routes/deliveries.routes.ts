import { Router } from 'express';
import { deliveriesController } from '../controllers/deliveries.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.use(authenticate);

router.get('/', deliveriesController.getDeliveries);
router.get('/:id', deliveriesController.getDeliveryById);
router.get('/:id/pdf', deliveriesController.generateDeliveryPDF);
router.post('/', deliveriesController.createDelivery);
router.put('/:id', deliveriesController.updateDelivery);
router.delete('/:id', deliveriesController.deleteDelivery);

export default router;