import { Prisma } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app.error';
import { ValidationError } from '../errors/http.errors';
import { logger } from '../observability/logger';

export function globalErrorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = (req as unknown as Record<string, unknown>).requestId as string | undefined;

  const parserError = error as { type?: string; status?: number };
  if (['entity.parse.failed', 'entity.too.large'].includes(parserError?.type ?? '')) {
    const status = parserError.type === 'entity.too.large' ? 413 : 400;
    res.status(status).json({ error: { code: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON', message: status === 413 ? 'Request body is too large.' : 'Malformed JSON body.', requestId } });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2025'].includes(error.code)) {
    res.status(error.code === 'P2002' ? 409 : 404).json({ error: { code: error.code === 'P2002' ? 'CONFLICT' : 'NOT_FOUND', message: 'The resource changed or is unavailable.', requestId } });
    return;
  }
  if (error instanceof ZodError) {
    const fields: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const path = issue.path.join('.') || '_root';
      if (!fields[path]) {
        fields[path] = [];
      }
      fields[path].push(issue.message);
    }

    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        fields,
        requestId,
      },
    });
    return;
  }

  if (error instanceof ValidationError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        fields: error.fields,
        requestId,
      },
    });
    return;
  }

  if (error instanceof AppError) {
    logger.warn({ err: error, requestId }, error.message);
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        requestId,
      },
    });
    return;
  }

  // Unexpected errors: log the full context, return a generic message
  logger.error({ errorType: error instanceof Error ? error.name : 'Unknown', requestId }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please retry or contact support with the request ID.',
      requestId,
    },
  });
}
