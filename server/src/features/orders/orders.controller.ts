import { Request, Response, NextFunction } from 'express';
import { OrdersService } from './orders.service';
import {
  CreateOrderSchema,
  OrderQuerySchema,
  UpdateOrderStatusSchema,
  OrderParamsSchema,
} from './orders.schema';

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string; isAdmin: boolean };
}

export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const dto = CreateOrderSchema.parse(req.body);
      const order = await this.ordersService.createOrder(authReq.user!.userId, dto);

      res.status(201).json({
        data: order,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = OrderParamsSchema.parse(req.params);
      const order = await this.ordersService.getOrder(
        authReq.user!.userId,
        id,
        authReq.user!.isAdmin,
      );

      res.status(200).json({
        data: order,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const query = OrderQuerySchema.parse(req.query);
      const result = await this.ordersService.getUserOrders(authReq.user!.userId, query);

      res.status(200).json({
        data: result.data,
        pagination: result.pagination,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  listAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = OrderQuerySchema.parse(req.query);
      const result = await this.ordersService.getAllOrders(query);

      res.status(200).json({
        data: result.data,
        pagination: result.pagination,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getTimeline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { id } = OrderParamsSchema.parse(req.params);
      const timeline = await this.ordersService.getOrderTimeline(
        authReq.user!.userId,
        id,
        authReq.user!.isAdmin,
      );

      res.status(200).json({
        data: timeline,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = OrderParamsSchema.parse(req.params);
      const { status } = UpdateOrderStatusSchema.parse(req.body);
      const order = await this.ordersService.updateOrderStatus(id, status);

      res.status(200).json({
        data: order,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
