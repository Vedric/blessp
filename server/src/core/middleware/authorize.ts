import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors/http.errors';
import type { AuthenticatedRequest } from '../types/request.context';

/**
 * Middleware that restricts access to admin users only.
 * Must be used after the authenticate middleware.
 */
export function authorizeAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const user = (req as AuthenticatedRequest).user;

  if (!user) {
    next(new UnauthorizedError('Authentication is required.'));
    return;
  }

  if (!user.isAdmin) {
    next(new ForbiddenError('Admin access is required for this resource.'));
    return;
  }

  next();
}
