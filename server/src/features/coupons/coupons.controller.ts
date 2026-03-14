import { Request, Response, NextFunction } from 'express';
import { CouponsService } from './coupons.service';
import {
  CreateCouponSchema,
  ValidateCouponSchema,
  ApplyCouponSchema,
  UpdateCouponSchema,
  CouponParamsSchema,
} from './coupons.schema';

export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  validate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = ValidateCouponSchema.parse(req.body);
      const result = await this.couponsService.validateCoupon(dto.code, dto.orderTotalCents);

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

  apply = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = ApplyCouponSchema.parse(req.body);
      const result = await this.couponsService.applyCoupon(dto.code, dto.orderTotalCents);

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

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = CreateCouponSchema.parse(req.body);
      const coupon = await this.couponsService.createCoupon(dto);

      res.status(201).json({
        data: coupon,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coupons = await this.couponsService.listCoupons();

      res.status(200).json({
        data: coupons,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = CouponParamsSchema.parse(req.params);
      const dto = UpdateCouponSchema.parse(req.body);
      const coupon = await this.couponsService.updateCoupon(id, dto);

      res.status(200).json({
        data: coupon,
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
