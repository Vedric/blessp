import { Router } from 'express';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartRepository } from './cart.repository';
import { ProductsRepository } from '../products/products.repository';
import { authenticate } from '../../core/middleware/authenticate';

const cartRepository = new CartRepository();
const productsRepository = new ProductsRepository();
const cartService = new CartService(cartRepository, productsRepository);
const cartController = new CartController(cartService);

const router = Router();

router.use(authenticate);

router.get('/', cartController.getCart);
router.post('/', cartController.addItem);
router.patch('/:itemId', cartController.updateItem);
router.delete('/:itemId', cartController.removeItem);
router.delete('/', cartController.clear);

export { router as cartRouter };
