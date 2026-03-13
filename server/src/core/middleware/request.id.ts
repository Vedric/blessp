import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a unique request ID for every incoming request.
 * If the client provides an X-Request-ID header, it is preserved.
 * Otherwise, a new UUID v4 is generated.
 * The ID is attached to both the request object and the response header.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) || uuidv4();

  (req as unknown as Record<string, unknown>).requestId = id;
  res.setHeader('X-Request-ID', id);

  next();
}
