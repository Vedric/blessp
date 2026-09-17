import { Request, Response, NextFunction } from 'express';
import { UsersService } from './users.service';
import {
  UpdateUserSchema,
  ChangePasswordSchema,
  DeleteAccountSchema,
  UpdateEmailPreferencesSchema,
} from './users.schema';
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

  deleteAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const dto = DeleteAccountSchema.parse(req.body);
      await this.usersService.deleteAccount(authReq.user!.userId, dto);

      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  };

  getEmailPreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const prefs = await this.usersService.getEmailPreferences(authReq.user!.userId);

      sendSuccess(res, req, prefs);
    } catch (error) {
      next(error);
    }
  };

  updateEmailPreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const dto = UpdateEmailPreferencesSchema.parse(req.body);
      const prefs = await this.usersService.updateEmailPreferences(authReq.user!.userId, dto);

      sendSuccess(res, req, prefs);
    } catch (error) {
      next(error);
    }
  };
}
