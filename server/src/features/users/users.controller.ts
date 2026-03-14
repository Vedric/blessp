import { Request, Response, NextFunction } from 'express';
import { UsersService } from './users.service';
import { UpdateUserSchema, ChangePasswordSchema } from './users.schema';

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string; isAdmin: boolean };
}

export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const user = await this.usersService.getProfile(authReq.user!.userId);

      res.status(200).json({
        data: user,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const dto = UpdateUserSchema.parse(req.body);
      const user = await this.usersService.updateProfile(authReq.user!.userId, dto);

      res.status(200).json({
        data: user,
        meta: {
          requestId: req.headers['x-request-id'] as string,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const dto = ChangePasswordSchema.parse(req.body);
      await this.usersService.changePassword(authReq.user!.userId, dto);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
