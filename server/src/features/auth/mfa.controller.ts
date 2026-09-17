import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { MfaService } from './mfa.service';
import { sendSuccess, sendCreated, sendNoContent } from '../../core/types/response';

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string; isAdmin: boolean };
}

const VerifySchema = z.object({
  token: z.string().regex(/^\d{6}$/, 'A 6-digit code is required.'),
}).strict();

// For disable, we accept either a 6-digit TOTP or a backup code (XXXXX-XXXXX).
// The service decides which code path to follow.
const DisableSchema = z.object({
  token: z.string().min(6).max(20).trim(),
}).strict();

export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  start = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const payload = await this.mfaService.startSetup(
        authReq.user!.userId,
        authReq.user!.email,
      );
      // Do not leak the raw secret over the network when we can avoid it; the
      // QR code and otpauth URL are sufficient for any authenticator app.
      sendCreated(res, req, {
        otpauthUrl: payload.otpauthUrl,
        qrCodeDataUrl: payload.qrCodeDataUrl,
      });
    } catch (error) {
      next(error);
    }
  };

  verify = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { token } = VerifySchema.parse(req.body);
      const result = await this.mfaService.verify(authReq.user!.userId, token);
      sendSuccess(res, req, {
        status: 'enabled',
        backupCodes: result.backupCodes,
      });
    } catch (error) {
      next(error);
    }
  };

  disable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { token } = DisableSchema.parse(req.body);
      await this.mfaService.disable(authReq.user!.userId, token);
      sendNoContent(res);
    } catch (error) {
      next(error);
    }
  };

  regenerateBackupCodes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { token } = VerifySchema.parse(req.body);
      const result = await this.mfaService.regenerateBackupCodes(authReq.user!.userId, token);
      sendSuccess(res, req, { backupCodes: result.backupCodes });
    } catch (error) {
      next(error);
    }
  };

  refuse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      await this.mfaService.refuse(authReq.user!.userId);
      sendSuccess(res, req, { status: 'refused' });
    } catch (error) {
      next(error);
    }
  };

  status = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const status = await this.mfaService.getStatus(authReq.user!.userId);
      sendSuccess(res, req, { status });
    } catch (error) {
      next(error);
    }
  };
}
