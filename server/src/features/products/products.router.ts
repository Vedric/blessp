import { Router } from 'express';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsRepository } from './products.repository';
import { authenticate } from '../../core/middleware/authenticate';
import { authorizeAdmin } from '../../core/middleware/authorize';

const productsRepository = new ProductsRepository();
const productsService = new ProductsService(productsRepository);
const productsController = new ProductsController(productsService);

const router = Router();

// Public routes
router.get('/', productsController.list);
router.get('/featured', productsController.featured);
router.get('/filters', productsController.filters);
router.get('/:id', productsController.getOne);
router.get('/:id/complete-look', productsController.completeLook);
router.get('/:id/variants', productsController.getVariants);

// Admin-only routes
router.post('/', authenticate, authorizeAdmin, productsController.create);
router.patch('/:id', authenticate, authorizeAdmin, productsController.update);
router.delete('/:id', authenticate, authorizeAdmin, productsController.delete);
router.put('/:id/variants', authenticate, authorizeAdmin, productsController.updateVariants);

export { router as productsRouter };
