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

export const emailOutboxPending = new Gauge({ name: 'email_outbox_pending', help: 'Undelivered durable email jobs', registers: [register] });
export const emailOutboxOldestSeconds = new Gauge({ name: 'email_outbox_oldest_seconds', help: 'Age of the oldest undelivered email', registers: [register] });

// Any non-zero value is an incident signal: it means a succeeded PaymentIntent
// reported an amount or currency that does not match the order it references.
export const paymentAmountMismatchTotal = new Counter({
  name: 'payment_amount_mismatch_total',
  help: 'Stripe payment_intent.succeeded events whose amount or currency did not match the referenced order',
  registers: [register],
});

export { register };
