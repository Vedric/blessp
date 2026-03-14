import { Request, Response, NextFunction } from 'express';
import { CartService } from './cart.service';
import { AddToCartSchema, UpdateCartItemSchema, CartItemParamsSchema } from './cart.schema';

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string; isAdmin: boolean };
}

export class CartController {
  constructor(private readonly cartService: CartService) {}

  getCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const cart = await this.cartService.getCart(authReq.user!.userId);

      res.status(200).json({
        data: cart,
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
      const dto = AddToCartSchema.parse(req.body);
      const cart = await this.cartService.addToCart(authReq.user!.userId, dto);

      res.status(201).json({
        data: cart,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  updateItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { itemId } = CartItemParamsSchema.parse(req.params);
      const dto = UpdateCartItemSchema.parse(req.body);
      const cart = await this.cartService.updateCartItem(authReq.user!.userId, itemId, dto);

      res.status(200).json({
        data: cart,
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
      const { itemId } = CartItemParamsSchema.parse(req.params);
      await this.cartService.removeFromCart(authReq.user!.userId, itemId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  clear = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      await this.cartService.clearCart(authReq.user!.userId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
