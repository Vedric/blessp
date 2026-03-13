import { Router } from 'express';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { ReviewsRepository } from './reviews.repository';
import { ProductsRepository } from '../products/products.repository';
import { authenticate } from '../../core/middleware/authenticate';

const reviewsRepository = new ReviewsRepository();
const productsRepository = new ProductsRepository();
const reviewsService = new ReviewsService(reviewsRepository, productsRepository);
const reviewsController = new ReviewsController(reviewsService);

const router = Router();

// Public routes
router.get('/', reviewsController.getProductReviews);
router.get('/summary/:productId', reviewsController.getReviewSummary);

// Authenticated routes
router.post('/', authenticate, reviewsController.createReview);
router.patch('/:id', authenticate, reviewsController.updateReview);
router.delete('/:id', authenticate, reviewsController.deleteReview);

export { router as reviewsRouter };
