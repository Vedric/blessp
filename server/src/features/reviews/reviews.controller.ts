import { Request, Response, NextFunction } from 'express';
import { ReviewsService } from './reviews.service';
import {
  CreateReviewSchema,
  UpdateReviewSchema,
  ReviewQuerySchema,
  ReviewParamsSchema,
  ProductIdParamsSchema,
} from './reviews.schema';
import { sendSuccess, sendCreated, sendPaginated, sendNoContent } from '../../core/types/response';

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string; isAdmin: boolean };
}

export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  getProductReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { productId, page, perPage } = ReviewQuerySchema.parse(req.query);
      const result = await this.reviewsService.getProductReviews(productId, page, perPage);

      sendPaginated(res, req, result.items, {
        page: result.page,
        perPage: result.perPage,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
      });
    } catch (error) {
      next(error);
    }
  };

  getReviewSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { productId } = ProductIdParamsSchema.parse(req.params);
      const summary = await this.reviewsService.getReviewSummary(productId);

      sendSuccess(res, req, summary);
    } catch (error) {
      next(error);
    }
  };

  createReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const dto = CreateReviewSchema.parse(req.body);
      const review = await this.reviewsService.createReview(authReq.user!.userId, dto);

      sendCreated(res, req, review);
    } catch (error) {
      next(error);
    }
  };

  updateReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = ReviewParamsSchema.parse(req.params);
      const dto = UpdateReviewSchema.parse(req.body);
      const review = await this.reviewsService.updateReview(authReq.user!.userId, id, dto);

      sendSuccess(res, req, review);
    } catch (error) {
      next(error);
    }
  };

  getAllReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
      const perPage = Math.min(Math.max(parseInt(req.query.perPage as string, 10) || 20, 1), 100);
      const result = await this.reviewsService.getAllReviews(page, perPage);

      sendPaginated(res, req, result.items, {
        page: result.page,
        perPage: result.perPage,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
      });
    } catch (error) {
      next(error);
    }
  };

  adminDeleteReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = ReviewParamsSchema.parse(req.params);
      await this.reviewsService.adminDeleteReview(id);

      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  };

  deleteReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = ReviewParamsSchema.parse(req.params);
      await this.reviewsService.deleteReview(authReq.user!.userId, id);

      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  };
}
