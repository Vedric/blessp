import client, { Registry, Counter, Histogram, Gauge } from 'prom-client';

const register = new Registry();

// Collect default process and runtime metrics (CPU, memory, event loop, GC)
client.collectDefaultMetrics({ register });

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

export const dbPoolWaiters = new Gauge({
  name: 'db_pool_waiters',
  help: 'Number of requests waiting for a database connection',
  registers: [register],
});

export { register };
