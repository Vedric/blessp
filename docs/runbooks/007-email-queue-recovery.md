# 007. Email Queue Recovery

**Status**: Active
**Last reviewed**: 2026-03-16

## Summary

Procedures for diagnosing and recovering from BullMQ email queue failures in the BLE$P
platform. Covers stalled jobs, Redis connection loss, dead letter queue inspection,
manual job retries, Prometheus metric monitoring, and the graceful fallback behaviour
when Redis is unavailable.

## When to use this runbook

- Order confirmation emails are not being delivered.
- Application logs show `Order confirmation email job failed` entries.
- The `job_queue_depth` Prometheus metric for the `email` queue is rising continuously.
- Redis connection errors appear in application logs.
- The BullMQ worker has stopped processing jobs (no `BullMQ email worker started` log
  on application startup, or worker crashed during runtime).

## Prerequisites

- Access to the production host via SSH or container console.
- `redis-cli` available (included in the `redis:7-alpine` container).
- Access to the monitoring dashboard (Grafana or equivalent) for Prometheus metrics.
- Familiarity with `004-redis-operations.md` for general Redis troubleshooting.

**Important**: Redis and BullMQ are optional for BLE$P. When Redis is unavailable, the
application falls back to synchronous email delivery. Email queue issues are typically
P3 severity unless they cause customer-visible delays across all orders.

## Steps

### 1. Assess the current state

#### 1.1 Check if the email worker is running

```bash
# Look for the worker startup log entry
docker compose logs --tail=200 app 2>&1 | grep -i "email worker"
```

Expected log entry on healthy startup:

```
BullMQ email worker started
```

If the entry is absent, the worker did not start, likely because Redis was unavailable
at application boot time.

#### 1.2 Check Redis connectivity

```bash
docker compose exec redis redis-cli ping
# Expected: PONG
```

If Redis is unreachable, refer to `004-redis-operations.md` for recovery steps.

#### 1.3 Check queue depth via Redis

```bash
# Waiting jobs
docker compose exec redis redis-cli LLEN "bull:email:wait"

# Active jobs (currently being processed)
docker compose exec redis redis-cli LLEN "bull:email:active"

# Delayed jobs (scheduled for retry)
docker compose exec redis redis-cli ZCARD "bull:email:delayed"

# Failed jobs (exhausted all retries)
docker compose exec redis redis-cli ZCARD "bull:email:failed"
```

#### 1.4 Check queue depth via Prometheus

If the monitoring stack is available, query the `job_queue_depth` metric:

```
job_queue_depth{queue_name="email"}
```

A steadily increasing value indicates that jobs are being enqueued faster than they are
being processed, or the worker has stopped consuming.

### 2. Diagnose stalled jobs

Stalled jobs occur when the worker crashes or loses its Redis connection while processing
a job. BullMQ automatically detects stalled jobs and moves them back to the waiting state
for reprocessing.

```bash
# Check for stalled job markers
docker compose exec redis redis-cli --scan --pattern "bull:email:stalled*"
```

If stalled jobs are accumulating:

1. Check application logs for worker crashes or unhandled exceptions.
2. Check Redis latency and connection stability.
3. Restart the application to reinitialise the worker:

```bash
docker compose restart app
```

### 3. Inspect failed jobs (dead letter queue)

The email queue is configured with 3 retry attempts using exponential backoff (initial
delay of 5 seconds). Jobs that exhaust all retries remain in the `failed` set.

#### 3.1 List failed job IDs

```bash
docker compose exec redis redis-cli ZRANGE "bull:email:failed" 0 -1
```

#### 3.2 Inspect a specific failed job

```bash
# Replace <job-id> with an actual job ID from the list above
docker compose exec redis redis-cli HGETALL "bull:email:<job-id>"
```

Look for the `failedReason` field to understand why the job failed (e.g., SMTP connection
timeout, invalid email address, template rendering error).

#### 3.3 Alert thresholds

| Threshold | Severity | Action |
|-----------|----------|--------|
| > 10 failed jobs | Warning | Investigate root cause, consider manual retry |
| > 50 failed jobs | Critical | Immediate investigation, check SMTP provider status |

### 4. Retry failed jobs

#### 4.1 Retry all failed jobs programmatically

The recommended approach is to use the BullMQ API from within the application. If a
script or admin endpoint is available:

```bash
# If the application exposes a queue management endpoint (admin only)
curl -X POST http://localhost:3000/api/v1/admin/queues/email/retry-failed \
  -H "Authorization: Bearer <admin-token>"
```

#### 4.2 Manual retry via Redis (when no admin endpoint is available)

Move failed jobs back to the waiting list manually:

```bash
# Get all failed job IDs
FAILED_IDS=$(docker compose exec -T redis redis-cli ZRANGE "bull:email:failed" 0 -1)

# For each failed job, remove it from the failed set and add it back to wait
for JOB_ID in $FAILED_IDS; do
  docker compose exec -T redis redis-cli ZREM "bull:email:failed" "$JOB_ID"
  docker compose exec -T redis redis-cli RPUSH "bull:email:wait" "$JOB_ID"
done
```

**Note**: This is a simplified approach. For production use, prefer the BullMQ API
which handles job state transitions correctly.

#### 4.3 Remove all failed jobs (if they are no longer relevant)

```bash
docker compose exec redis redis-cli DEL "bull:email:failed"
```

### 5. Handle Redis connection loss

When Redis becomes unavailable, the BLE$P application handles it gracefully:

1. **Email producer**: Falls back to synchronous email delivery. The log entry
   `Redis unavailable, sending order confirmation email synchronously` indicates this
   fallback is active.
2. **Email worker**: Stops processing. No new jobs can be enqueued or consumed.
3. **Application health**: The `/health/ready` endpoint will report Redis as unavailable,
   but the application continues to serve requests.

#### 5.1 Recovery after Redis reconnection

When Redis comes back online:

1. The email queue will automatically reconnect and resume processing waiting jobs.
2. The email worker should reconnect automatically. If it does not, restart the
   application:

```bash
docker compose restart app
```

3. Check for any orders placed during the outage that received synchronous email
   delivery (look for `sending order confirmation email synchronously` in the logs).
   These orders do not need reprocessing.

#### 5.2 If Redis was reset (data loss)

If Redis was flushed or the volume was deleted during the outage:

1. All pending email jobs are lost.
2. Identify orders placed during the outage window by querying the database:

```bash
docker compose exec db psql -U blessp -d blessp -c "
  SELECT id, created_at, status
  FROM orders
  WHERE created_at > '<outage-start-timestamp>'
    AND status = 'paid'
  ORDER BY created_at;
"
```

3. For each affected order, manually trigger the confirmation email (if an admin
   endpoint or script is available), or accept the gap if the synchronous fallback
   already sent the email.

### 6. Monitor queue health over time

#### 6.1 Key Prometheus metrics

| Metric | Description | Alert threshold |
|--------|-------------|----------------|
| `job_queue_depth{queue_name="email"}` | Number of pending jobs in the email queue | > 100 for more than 5 minutes |
| `http_requests_total{route="/api/v1/payments/webhook"}` | Webhook delivery volume (correlates with email volume) | Baseline comparison |

#### 6.2 Log-based monitoring

```bash
# Count failed email jobs in recent logs
docker compose logs --tail=1000 app 2>&1 | grep -c "email job failed"

# Count successful email deliveries
docker compose logs --tail=1000 app 2>&1 | grep -c "email sent successfully"

# Count synchronous fallback invocations
docker compose logs --tail=1000 app 2>&1 | grep -c "sending order confirmation email synchronously"
```

### 7. Restart the email worker

If the worker is in a bad state and reconnection has not resolved the issue:

```bash
# Restart the application (the worker starts as part of the application boot)
docker compose restart app

# Verify the worker started
docker compose logs --tail=50 app 2>&1 | grep "email worker"
```

If the worker still does not start, check Redis connectivity (step 1.2) and review
the full application startup logs for errors.

## Verification

- [ ] `redis-cli ping` returns `PONG`.
- [ ] Application logs show `BullMQ email worker started` after the most recent restart.
- [ ] `LLEN "bull:email:wait"` is stable or decreasing (jobs are being consumed).
- [ ] `ZCARD "bull:email:failed"` is within acceptable thresholds (< 10).
- [ ] `/health/ready` returns 200.
- [ ] New orders trigger email delivery (test with a development order if possible).
- [ ] `job_queue_depth{queue_name="email"}` metric is not trending upward.

## Rollback procedure

The email queue is not a system of record. Lost email jobs do not affect order state or
payment processing.

- If the queue is in an unrecoverable state, clear it entirely and let new orders
  generate fresh jobs:

```bash
docker compose exec redis redis-cli KEYS "bull:email:*" | \
  xargs -r docker compose exec -T redis redis-cli DEL
```

- If Redis itself needs to be reset, refer to `004-redis-operations.md` for the full
  reset procedure. The application will fall back to synchronous email delivery
  automatically.

- Emails that were lost and never sent can be identified by cross-referencing the orders
  table with the email delivery logs. Re-send manually as needed.

## Escalation contacts

| Role | Contact |
|------|---------|
| Backend Lead | Internal team channel |
| DevOps / Infrastructure | Internal team channel |
| SMTP Provider Support | Provider dashboard (for delivery failures caused by the mail service) |
