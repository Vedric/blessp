import { Router } from 'express';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyRepository } from './loyalty.repository';
import { authenticate } from '../../core/middleware/authenticate';

const loyaltyRepository = new LoyaltyRepository();
const loyaltyService = new LoyaltyService(loyaltyRepository);
const loyaltyController = new LoyaltyController(loyaltyService);

const router = Router();

router.use(authenticate);

router.get('/balance', loyaltyController.getBalance);
router.get('/transactions', loyaltyController.getTransactions);
router.post('/redeem', loyaltyController.redeem);

export { router as loyaltyRouter };
