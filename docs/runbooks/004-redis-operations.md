# 004. Redis Operations

**Status**: Active
**Last reviewed**: 2026-03-14

## Summary

Operational procedures for managing the Redis instance used by BLE$P for application
caching and BullMQ background job processing. Covers health checks, cache management,
queue monitoring, and troubleshooting.

## When to use this runbook

- Redis health check failures appear in monitoring or logs.
- Cache data needs to be flushed (selectively or entirely).
- BullMQ jobs are stuck, failing, or accumulating in the dead-letter queue.
- Redis memory usage is unexpectedly high.
- Connection pool issues are logged by the application.

## Prerequisites

- Access to the production host via SSH or container console.
- `redis-cli` available (included in the `redis:7-alpine` container).
- Familiarity with BullMQ queue naming conventions used by BLE$P.

**Important**: Redis is optional for BLE$P. When Redis is unavailable, the application
falls back to no-op caching and synchronous email delivery. Redis issues are typically
P3 severity unless they cause cascading failures.

## Steps

### 1. Health check

#### 1.1 Basic connectivity

```bash
# From the host (if Redis port is exposed)
redis-cli -u redis://localhost:6379 ping
# Expected: PONG

# From inside Docker Compose
docker compose exec redis redis-cli ping
```

#### 1.2 Memory usage

```bash
docker compose exec redis redis-cli INFO memory
```

Key metrics to check:

| Metric | Healthy range | Action if exceeded |
|--------|--------------|-------------------|
| `used_memory_human` | < 75% of `maxmemory` | Investigate large keys, flush stale data |
| `mem_fragmentation_ratio` | 1.0 to 1.5 | Values > 1.5 indicate fragmentation; restart Redis |
| `used_memory_peak_human` | Comparable to `used_memory` | Large gap suggests a past memory spike |

#### 1.3 Connection count

```bash
docker compose exec redis redis-cli INFO clients
```

Check `connected_clients`. If this number is close to `maxclients` (default 10000),
the application may be leaking connections.

#### 1.4 Key count and database size

```bash
docker compose exec redis redis-cli DBSIZE
```

### 2. Cache operations

#### 2.1 Selective cache flush by pattern

BLE$P uses namespaced cache keys with the pattern `blessp:<resource>:<id>`.

```bash
# List keys matching a pattern (use cautiously in production)
docker compose exec redis redis-cli --scan --pattern "blessp:users:*"

# Delete all keys matching a pattern
docker compose exec redis redis-cli --scan --pattern "blessp:users:*" | \
  xargs -r docker compose exec -T redis redis-cli DEL
```

Common cache key patterns:

| Pattern | Description |
|---------|-------------|
| `blessp:users:*` | Cached user data |
| `blessp:products:*` | Cached product data |
| `blessp:sessions:*` | Session-related cache entries |

#### 2.2 Full cache flush

**Warning**: This clears all cached data. The application will rebuild caches on
subsequent requests, but expect a temporary increase in database load.

```bash
docker compose exec redis redis-cli FLUSHDB
```

To flush with confirmation:

```bash
docker compose exec redis redis-cli FLUSHDB ASYNC
```

#### 2.3 Inspect a specific key

```bash
# Check key type
docker compose exec redis redis-cli TYPE "blessp:users:<user-id>"

# Get TTL
docker compose exec redis redis-cli TTL "blessp:users:<user-id>"

# Get value (for string keys)
docker compose exec redis redis-cli GET "blessp:users:<user-id>"
```

### 3. BullMQ queue monitoring

BLE$P uses BullMQ for background email processing. The queue name is `email`.

#### 3.1 Check queue depth

```bash
# Count jobs in each state
docker compose exec redis redis-cli --scan --pattern "bull:email:*" | \
  sort | head -20

# Waiting jobs
docker compose exec redis redis-cli LLEN "bull:email:wait"

# Active jobs
docker compose exec redis redis-cli LLEN "bull:email:active"

# Delayed jobs
docker compose exec redis redis-cli ZCARD "bull:email:delayed"

# Failed jobs
docker compose exec redis redis-cli ZCARD "bull:email:failed"
```

#### 3.2 Inspect failed jobs

```bash
# List failed job IDs
docker compose exec redis redis-cli ZRANGE "bull:email:failed" 0 -1

# Get details of a specific failed job
docker compose exec redis redis-cli HGETALL "bull:email:<job-id>"
```

#### 3.3 Check dead-letter queue

Jobs that exhaust all retry attempts (3 retries with exponential backoff) are moved
to the failed set. Monitor this count:

```bash
docker compose exec redis redis-cli ZCARD "bull:email:failed"
```

Alert thresholds:

| Threshold | Severity |
|-----------|----------|
| > 10 failed jobs | Warning |
| > 50 failed jobs | Critical |

### 4. Clearing stuck or failed jobs

#### 4.1 Retry all failed jobs

```bash
# This requires a script or BullMQ dashboard
# From the application, programmatically:
# queue.retryJobs({ state: 'failed' })
```

#### 4.2 Remove all failed jobs

```bash
# Remove the failed set
docker compose exec redis redis-cli DEL "bull:email:failed"
```

#### 4.3 Clear the entire queue

**Warning**: This removes all pending, active, delayed, and failed jobs.

```bash
docker compose exec redis redis-cli KEYS "bull:email:*" | \
  xargs -r docker compose exec -T redis redis-cli DEL
```

#### 4.4 Drain the queue (remove waiting jobs only)

```bash
docker compose exec redis redis-cli DEL "bull:email:wait"
docker compose exec redis redis-cli DEL "bull:email:paused"
```

### 5. Redis memory troubleshooting

#### 5.1 Find large keys

```bash
docker compose exec redis redis-cli --bigkeys
```

#### 5.2 Analyze memory usage of a key

```bash
docker compose exec redis redis-cli MEMORY USAGE "blessp:products:<id>"
```

#### 5.3 Check eviction policy

```bash
docker compose exec redis redis-cli CONFIG GET maxmemory-policy
```

Recommended policy for caching: `allkeys-lru` (evicts least recently used keys
when memory is full).

```bash
# Set the eviction policy (persists until restart unless saved)
docker compose exec redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

#### 5.4 Set a memory limit

```bash
docker compose exec redis redis-cli CONFIG SET maxmemory 256mb
```

### 6. Connection pool issues

#### 6.1 Symptoms

- Application logs: `Redis connection error` or `MaxRetriesPerRequestError`.
- `connected_clients` in `INFO clients` is abnormally high.
- Slow responses on endpoints that use caching.

#### 6.2 Investigation

```bash
# Check current connections
docker compose exec redis redis-cli CLIENT LIST

# Check connection count
docker compose exec redis redis-cli INFO clients | grep connected_clients
```

#### 6.3 Resolution

1. Restart the application to reset connection pools:

```bash
docker compose restart app
```

2. If connections are leaking, check the application logs for Redis client errors
   and verify that the Redis client is being properly closed during graceful shutdown.

3. If the issue persists, restart Redis (this drops all connections and cached data):

```bash
docker compose restart redis
```

## Verification

After any Redis operation, verify:

- [ ] `redis-cli ping` returns `PONG`.
- [ ] Application health check (`/health/ready`) returns 200.
- [ ] No `Redis connection error` entries in recent application logs.
- [ ] BullMQ worker is processing jobs (check for `BullMQ email worker started` in logs).
- [ ] Cache is rebuilding (first requests after flush may be slower).

## Rollback procedure

Redis is a cache layer, not a system of record. Data loss in Redis is not catastrophic.

- If Redis becomes unresponsive, the application falls back to no-op mode automatically.
- If Redis data is corrupted, flush the database (`FLUSHDB`) and let caches rebuild.
- If Redis needs to be fully reset, stop the container and delete the volume:

```bash
docker compose stop redis
docker volume rm blessp_redisdata
docker compose up -d redis
```

**Note**: Flushing or resetting Redis deletes all BullMQ job data. Any pending email
jobs will be lost and must be re-triggered manually if needed.

## Escalation contacts

| Role | Contact |
|------|---------|
| Backend Lead | Internal team channel |
| DevOps / Infrastructure | Internal team channel |
