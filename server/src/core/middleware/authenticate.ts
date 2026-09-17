import { prisma } from '../database/client';
import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../security/token.service';
import { UnauthorizedError } from '../errors/http.errors';
import type { AuthenticatedRequest } from '../types/request.context';

const tokenService = new TokenService();

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or malformed authorization header.');
    }

    const token = authHeader.slice(7);

    if (!token) {
      throw new UnauthorizedError('Missing bearer token.');
    }

    const payload = tokenService.verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { deletedAt: true, sessionVersion: true, isAdmin: true, email: true } });
    if (!user || user.deletedAt || user.sessionVersion !== payload.sessionVersion) {
      throw new UnauthorizedError('Session revoked. Please sign in again.');
    }
    (req as AuthenticatedRequest).user = { ...payload, email: user.email, isAdmin: user.isAdmin };

    next();
  } catch (error) {
    next(error);
  }
}
