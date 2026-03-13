import { Request, Response, NextFunction } from 'express';
import { WishlistService } from './wishlist.service';
import { AddToWishlistSchema, WishlistProductParamsSchema } from './wishlist.schema';

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string; isAdmin: boolean };
}

export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  getWishlist = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const items = await this.wishlistService.getWishlist(authReq.user!.userId);

      res.status(200).json({
        data: items,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const dto = AddToWishlistSchema.parse(req.body);
      const result = await this.wishlistService.toggleWishlistItem(authReq.user!.userId, dto.productId);

      res.status(200).json({
        data: result,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  removeItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { productId } = WishlistProductParamsSchema.parse(req.params);
      await this.wishlistService.removeFromWishlist(authReq.user!.userId, productId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
