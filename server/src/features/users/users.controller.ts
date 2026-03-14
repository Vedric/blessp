import { Request, Response, NextFunction } from 'express';
import { UsersService } from './users.service';
import { UpdateUserSchema, ChangePasswordSchema } from './users.schema';
import { sendSuccess, sendNoContent } from '../../core/types/response';

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string; isAdmin: boolean };
}

export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = await this.usersService.getProfile(authReq.user!.userId);

      sendSuccess(res, req, user);
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const dto = UpdateUserSchema.parse(req.body);
      const user = await this.usersService.updateProfile(authReq.user!.userId, dto);

      sendSuccess(res, req, user);
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const dto = ChangePasswordSchema.parse(req.body);
      await this.usersService.changePassword(authReq.user!.userId, dto);

      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  };
}
