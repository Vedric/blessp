import { Router } from 'express';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { CouponsRepository } from './coupons.repository';
import { authenticate } from '../../core/middleware/authenticate';
import { authorizeAdmin } from '../../core/middleware/authorize';

const couponsRepository = new CouponsRepository();
const couponsService = new CouponsService(couponsRepository);
const couponsController = new CouponsController(couponsService);

const router = Router();

router.use(authenticate);

// Authenticated user routes
router.post('/validate', couponsController.validate);
router.post('/apply', couponsController.apply);

// Admin-only routes
router.post('/', authorizeAdmin, couponsController.create);
router.get('/', authorizeAdmin, couponsController.list);
router.patch('/:id', authorizeAdmin, couponsController.update);

export { router as couponsRouter };
