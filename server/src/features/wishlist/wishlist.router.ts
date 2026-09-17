import { Router } from 'express';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';
import { WishlistRepository } from './wishlist.repository';
import { ProductsRepository } from '../products/products.repository';
import { authenticate } from '../../core/middleware/authenticate';

const wishlistRepository = new WishlistRepository();
const productsRepository = new ProductsRepository();
const wishlistService = new WishlistService(wishlistRepository, productsRepository);
const wishlistController = new WishlistController(wishlistService);

const router = Router();

router.use(authenticate);

router.get('/', wishlistController.getWishlist);
router.post('/', wishlistController.addItem);
router.delete('/:productId', wishlistController.removeItem);

export { router as wishlistRouter };
