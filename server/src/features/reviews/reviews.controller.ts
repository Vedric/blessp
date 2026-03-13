import { Request, Response, NextFunction } from 'express';
import { ReviewsService } from './reviews.service';
import {
  CreateReviewSchema,
  UpdateReviewSchema,
  ReviewQuerySchema,
  ReviewParamsSchema,
  ProductIdParamsSchema,
} from './reviews.schema';

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string; isAdmin: boolean };
}

export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  getProductReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { productId, page, perPage } = ReviewQuerySchema.parse(req.query);
      const result = await this.reviewsService.getProductReviews(productId, page, perPage);

      res.status(200).json({
        data: result.items,
        pagination: {
          page: result.page,
          perPage: result.perPage,
          totalItems: result.totalItems,
          totalPages: result.totalPages,
        },
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getReviewSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { productId } = ProductIdParamsSchema.parse(req.params);
      const summary = await this.reviewsService.getReviewSummary(productId);

      res.status(200).json({
        data: summary,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  createReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const dto = CreateReviewSchema.parse(req.body);
      const review = await this.reviewsService.createReview(authReq.user!.userId, dto);

      res.status(201).json({
        data: review,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
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

      res.status(200).json({
        data: review,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getAllReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
      const perPage = Math.min(Math.max(parseInt(req.query.perPage as string, 10) || 20, 1), 100);
      const result = await this.reviewsService.getAllReviews(page, perPage);

      res.status(200).json({
        data: result.items,
        pagination: {
          page: result.page,
          perPage: result.perPage,
          totalItems: result.totalItems,
          totalPages: result.totalPages,
        },
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  adminDeleteReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = ReviewParamsSchema.parse(req.params);
      await this.reviewsService.adminDeleteReview(id);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  deleteReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = ReviewParamsSchema.parse(req.params);
      await this.reviewsService.deleteReview(authReq.user!.userId, id);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
