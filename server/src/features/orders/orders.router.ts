import { Router } from 'express';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { CartRepository } from '../cart/cart.repository';
import { CouponsService } from '../coupons/coupons.service';
import { CouponsRepository } from '../coupons/coupons.repository';
import { VariantsRepository } from '../products/variants.repository';
import { authenticate } from '../../core/middleware/authenticate';
import { authorizeAdmin } from '../../core/middleware/authorize';

const ordersRepository = new OrdersRepository();
const cartRepository = new CartRepository();
const couponsRepository = new CouponsRepository();
const variantsRepository = new VariantsRepository();
const couponsService = new CouponsService(couponsRepository);
const ordersService = new OrdersService(ordersRepository, cartRepository, couponsService, variantsRepository);
const ordersController = new OrdersController(ordersService);

const router = Router();

router.use(authenticate);

router.post('/', ordersController.create);
router.get('/mine', ordersController.listMine);
router.get('/', authorizeAdmin, ordersController.listAll);
router.get('/:id', ordersController.getOne);
router.get('/:id/timeline', ordersController.getTimeline);
router.patch('/:id/status', authorizeAdmin, ordersController.updateStatus);

export { router as ordersRouter };
