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

router.use((req, res, next) => {
  if (req.headers.authorization) return authenticate(req, res, next);
  next();
});

// Authenticated user routes
router.post('/validate', couponsController.validate);
router.post('/apply', couponsController.apply);

// Admin-only routes
router.post('/', authenticate, authorizeAdmin, couponsController.create);
router.get('/', authenticate, authorizeAdmin, couponsController.list);
router.patch('/:id', authenticate, authorizeAdmin, couponsController.update);

export { router as couponsRouter };
