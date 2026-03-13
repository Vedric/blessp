import { Router } from 'express';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { ReviewsRepository } from './reviews.repository';
import { ProductsRepository } from '../products/products.repository';
import { authenticate } from '../../core/middleware/authenticate';
import { authorizeAdmin } from '../../core/middleware/authorize';

const reviewsRepository = new ReviewsRepository();
const productsRepository = new ProductsRepository();
const reviewsService = new ReviewsService(reviewsRepository, productsRepository);
const reviewsController = new ReviewsController(reviewsService);

const router = Router();

// Public routes
router.get('/', reviewsController.getProductReviews);
router.get('/summary/:productId', reviewsController.getReviewSummary);

// Admin routes (must appear before /:id to avoid route conflicts)
router.get('/admin/all', authenticate, authorizeAdmin, reviewsController.getAllReviews);
router.delete('/admin/:id', authenticate, authorizeAdmin, reviewsController.adminDeleteReview);

// Authenticated routes
router.post('/', authenticate, reviewsController.createReview);
router.patch('/:id', authenticate, reviewsController.updateReview);
router.delete('/:id', authenticate, reviewsController.deleteReview);

export { router as reviewsRouter };
