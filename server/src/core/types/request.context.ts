import { Request } from 'express';
import type { AccessTokenPayload } from '../security/token.service';

export interface AuthenticatedRequest extends Request {
  user: AccessTokenPayload;
  requestId?: string;
}

export interface RequestWithId extends Request {
  requestId?: string;
}
