import { Request, Response, NextFunction } from 'express';
import { httpRequestDuration, httpRequestTotal } from '../observability/metrics';

/**
 * Normalizes an Express route path by replacing dynamic parameter values
 * with their placeholder names to prevent high-cardinality label values.
 *
 * Falls back to the raw URL path when no matched route is available.
 */
function normalizeRoutePath(req: Request): string {
  // Express 5 populates req.route when a route is matched
  if (req.route?.path) {
    const mountPath = req.baseUrl || '';
    return `${mountPath}${req.route.path}`;
  }

  // Fallback: collapse UUID and numeric path segments into :id
  return req.path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
}

/**
 * Records HTTP request duration and increments the total request counter.
 * This middleware should be mounted early in the stack so that the timer
 * captures the full request lifecycle.
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - startTime);
    const durationSeconds = durationNs / 1e9;

    const route = normalizeRoutePath(req);
    const method = req.method;
    const statusCode = String(res.statusCode);

    httpRequestDuration.observe(
      { method, route, status_code: statusCode },
      durationSeconds,
    );

    httpRequestTotal.inc({ method, route, status_code: statusCode });
  });

  next();
}
