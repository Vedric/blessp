import { Request, Response, NextFunction } from 'express';
import { CouponsService } from './coupons.service';
import {
  CreateCouponSchema,
  ValidateCouponSchema,
  ApplyCouponSchema,
  UpdateCouponSchema,
  CouponParamsSchema,
} from './coupons.schema';
import { sendSuccess, sendCreated } from '../../core/types/response';

export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  validate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = ValidateCouponSchema.parse(req.body);
      const result = await this.couponsService.validateCoupon(dto.code, dto.orderTotalCents);

      sendSuccess(res, req, result);
    } catch (error) {
      next(error);
    }
  };

  apply = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = ApplyCouponSchema.parse(req.body);
      const result = await this.couponsService.applyCoupon(dto.code, dto.orderTotalCents);

      sendSuccess(res, req, result);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = CreateCouponSchema.parse(req.body);
      const coupon = await this.couponsService.createCoupon(dto);

      sendCreated(res, req, coupon);
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coupons = await this.couponsService.listCoupons();

      sendSuccess(res, req, coupons);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = CouponParamsSchema.parse(req.params);
      const dto = UpdateCouponSchema.parse(req.body);
      const coupon = await this.couponsService.updateCoupon(id, dto);

      sendSuccess(res, req, coupon);
    } catch (error) {
      next(error);
    }
  };
}
