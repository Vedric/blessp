# 🚀 Deployment Guide

Complete guide to deploying the BLE$$ P e-commerce platform in development, staging, and production environments.

## 📑 Table of Contents

- [Prerequisites](#-prerequisites)
- [Environment Variables](#-environment-variables)
- [Docker Deployment (Production)](#-docker-deployment-production)
- [Docker Deployment (Development)](#-docker-deployment-development)
- [Manual Deployment](#-manual-deployment)
- [Database Migrations](#-database-migrations)
- [Health Check Endpoints](#-health-check-endpoints)
- [Graceful Shutdown](#-graceful-shutdown)
- [Monitoring and Observability](#-monitoring-and-observability)
- [Security Checklist](#-security-checklist)
- [Backup Strategy](#-backup-strategy)
- [Troubleshooting](#-troubleshooting)

## 📋 Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | 22+ | Runtime for the server and build tooling |
| PostgreSQL | 16+ | Primary database |
| Docker | 24+ | Containerized deployment |
| Docker Compose | v2+ | Multi-service orchestration |
| Stripe Account | | Payment processing (API keys required) |

## 🔧 Environment Variables

All configuration is injected via environment variables. The application validates every variable at startup using **Zod** and will **refuse to start** if any required variable is missing or invalid.

The validation schema lives in `server/src/core/config/env.ts`.

### Required Variables

| Variable | Type | Validation | Description |
|----------|------|------------|-------------|
| `DATABASE_URL` | `string` | Min 1 character | PostgreSQL connection string (e.g., `postgresql://user:pass@host:5432/dbname`) |
| `JWT_PRIVATE_KEY_BASE64` | `string` | Min 1 character | 🔑 Base64-encoded RSA private key (PEM) for signing JWTs |
| `JWT_PUBLIC_KEY_BASE64` | `string` | Min 1 character | 🔑 Base64-encoded RSA public key (PEM) for verifying JWTs |

### Optional Variables (with defaults)

| Variable | Type | Default | Validation | Description |
|----------|------|---------|------------|-------------|
| `NODE_ENV` | `enum` | `development` | `development`, `test`, `production` | Runtime environment |
| `PORT` | `number` | `3000` | Positive integer | HTTP server listening port |
| `LOG_LEVEL` | `enum` | `info` | `trace`, `debug`, `info`, `warn`, `error` | 📊 Pino log verbosity |
| `JWT_ACCESS_EXPIRY` | `string` | `15m` | Any valid duration string | Access token time-to-live |
| `JWT_REFRESH_EXPIRY` | `string` | `7d` | Any valid duration string | Refresh token time-to-live |
| `CORS_ALLOWED_ORIGINS` | `string` | `http://localhost:3000` | Comma-separated URLs | 🌐 Allowed CORS origins |
| `STRIPE_SECRET_KEY` | `string` | (none) | Min 1 character if provided | 💳 Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | `string` | (none) | Min 1 character if provided | 💳 Stripe webhook signing secret |
| `SERVICE_NAME` | `string` | `blessp-api` | Any string | 📊 Service name in log output |
| `SERVICE_VERSION` | `string` | `3.0.0` | Any string | 📊 Version tag in log output |

### 🔒 Security Rules for Environment Variables

1. **Never commit `.env` files** with real credentials. The `.gitignore` already excludes them.
2. **Use a secrets manager** in production (HashiCorp Vault, AWS Secrets Manager, Azure Key Vault).
3. **Rotate JWT secrets** every 90 days, or immediately after any suspected exposure.
4. **Generate strong secrets** using `openssl rand -base64 48` (produces a 64-character base64 string).
5. **Use separate secrets** for each environment. Never share JWT secrets between staging and production.

### 📄 Example `.env` File

The repository includes a `.env.example` file with placeholder values:

```bash
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

DATABASE_URL=postgresql://blessp:blessp_dev_password@localhost:5433/blessp

JWT_PRIVATE_KEY_BASE64=<base64-encoded-RSA-private-key-PEM>
JWT_PUBLIC_KEY_BASE64=<base64-encoded-RSA-public-key-PEM>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

STRIPE_SECRET_KEY=sk_test_placeholder
STRIPE_WEBHOOK_SECRET=whsec_test_placeholder

SERVICE_NAME=blessp-api
SERVICE_VERSION=3.0.0
```

## 🐳 Docker Deployment (Production)

The recommended production deployment uses Docker Compose with a multi-stage Dockerfile.

### Architecture

```
┌────────────────────────────────────────────┐
│              Docker Compose                │
│                                            │
│  ┌──────────┐         ┌──────────────────┐ │
│  │    db     │         │       app        │ │
│  │ Postgres  │◄────────│  Node.js 22      │ │
│  │ 16-alpine │  :5432  │  (non-root)      │ │
│  │  :5433    │         │  :3000           │ │
│  │  (host)   │         │                  │ │
│  │  📁 pgdata│         │  Express API     │ │
│  │  (volume) │         │  + React SPA     │ │
│  └──────────┘         │  (static files)  │ │
│                        └──────────────────┘ │
└────────────────────────────────────────────┘
```

### Dockerfile Stages

The production image is built in three stages to minimize the final image size:

| Stage | Base Image | Purpose |
|-------|-----------|---------|
| 🔧 `deps` | `node:22-alpine` | Install server and client npm dependencies (`npm ci`) |
| 🏗️ `builder` | `node:22-alpine` | Generate Prisma Client, build the server (TypeScript → JavaScript), build the client (Vite production build) |
| 🚀 `production` | `node:22-alpine` | Final image with only `dist/`, `node_modules/`, `prisma/`, and `public/` (client build output) |

**Security features of the production image:**

- ✅ Runs as non-root user (`appuser` in `appgroup`)
- ✅ Built-in `HEALTHCHECK` instruction (polls `/health/live` every 30 seconds)
- ✅ Only production artifacts are included (no source code, no dev dependencies)
- ✅ `NODE_ENV=production` is baked into the image

### Build and Start

```bash
# Build and start all services in detached mode
docker compose up --build -d

# View logs
docker compose logs -f app

# Check container health
docker compose ps
```

### Run Migrations Inside the Container

```bash
docker compose exec app npx prisma migrate deploy
```

### Seed the Database (optional, first deploy only)

```bash
docker compose exec app npx prisma db seed
```

### Rebuild After Code Changes

```bash
docker compose up --build -d
```

### Stop All Services

```bash
# Stop and remove containers (preserves volumes)
docker compose down

# Stop and remove containers AND volumes (destroys database data!)
docker compose down -v
```

### 🔒 Production Hardening

Before deploying to a real production environment, apply these changes to `docker-compose.yml`:

1. **Replace all placeholder secrets** with strong, randomly generated values
2. **Restrict `CORS_ALLOWED_ORIGINS`** to your actual frontend domain(s)
3. **Use production Stripe keys** (replace `sk_test_placeholder` and `whsec_test_placeholder`)
4. **Pin the base image** to a specific digest for reproducible builds
5. **Scan the built image** with Trivy or a similar tool before deployment. Block on `CRITICAL` CVEs
6. **Configure a reverse proxy** (nginx, Caddy, or a cloud load balancer) in front of the application for TLS termination
7. **Set `restart: unless-stopped`** on the app service (already configured in the default compose file)

## 🛠️ Docker Deployment (Development)

The development setup uses `docker-compose.dev.yml` with three services and hot reload for both server and client.

### Architecture

```
┌──────────────────────────────────────────────────────┐
│              Docker Compose (Dev)                    │
│                                                      │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │    db     │  │    server    │  │    client     │  │
│  │ Postgres  │  │  node:22    │  │  node:22      │  │
│  │ 16-alpine │  │  tsx watch  │  │  vite dev     │  │
│  │  :5433    │  │  :3000      │  │  :5173        │  │
│  │           │  │             │  │               │  │
│  │  📁 pgdata│  │  📁 bind    │  │  📁 bind      │  │
│  │  (volume) │  │    mount    │  │    mount      │  │
│  └──────────┘  └──────────────┘  └───────────────┘  │
└──────────────────────────────────────────────────────┘
```

### Key Differences from Production

| Feature | Production | Development |
|---------|-----------|-------------|
| Build | Multi-stage Dockerfile | Raw `node:22-alpine` image |
| Hot reload | No | ✅ tsx watch (server) + Vite HMR (client) |
| Source code | Copied into image | Bind-mounted from host |
| node_modules | Copied from deps stage | Named volumes (isolated from host) |
| Services | 2 (db + app) | 3 (db + server + client) |
| Startup command | `node dist/server.js` | `npm install && prisma generate && prisma db push && seed && npm run dev` |

### Start the Development Environment

```bash
# From the project root
docker compose -f docker-compose.dev.yml up

# Or in detached mode
docker compose -f docker-compose.dev.yml up -d
```

The server starts on `http://localhost:3000` and the client on `http://localhost:5173`. Edit any file on the host and changes are reflected immediately.

### Reset the Dev Database

```bash
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up
```

## 📦 Manual Deployment

For environments without Docker, deploy the application manually.

### Step 1: Install Dependencies

```bash
# Server (production dependencies only)
cd server && npm ci --omit=dev

# Client
cd client && npm ci
```

### Step 2: Generate Prisma Client

```bash
cd server && npx prisma generate
```

### Step 3: Build Both Packages

```bash
# Build the server (TypeScript → JavaScript in dist/)
cd server && npm run build

# Build the client (Vite production build in dist/)
cd client && npm run build
```

### Step 4: Copy Client Build to Server

```bash
# The Express server serves static files from the public/ directory
cp -r client/dist server/public
```

### Step 5: Run Database Migrations

```bash
cd server && npx prisma migrate deploy
```

### Step 6: (Optional) Seed the Database

```bash
cd server && npx prisma db seed
```

### Step 7: Start the Server

```bash
cd server && NODE_ENV=production node dist/server.js
```

### 🔄 Using a Process Manager

For production manual deployments, use a process manager to handle restarts and log management:

```bash
# With PM2
pm2 start dist/server.js --name blessp-api --env production

# View logs
pm2 logs blessp-api

# Monitor
pm2 monit
```

### 🌐 Reverse Proxy Configuration

For manual deployments, place a reverse proxy (nginx, Caddy) in front of the Node.js process:

**nginx example:**

```nginx
server {
    listen 443 ssl http2;
    server_name api.blessp.com;

    ssl_certificate     /etc/ssl/certs/blessp.pem;
    ssl_certificate_key /etc/ssl/private/blessp.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name api.blessp.com;
    return 301 https://$host$request_uri;
}
```

## 🗄️ Database Migrations

### Applying Migrations

```bash
# 🔧 Development (generates SQL and applies it)
cd server && npx prisma migrate dev --name <description>

# 🚀 Production (applies pending migrations only, never generates new ones)
cd server && npx prisma migrate deploy

# 📊 Check migration status
cd server && npx prisma migrate status
```

### Migration Best Practices

| Practice | Rationale |
|----------|-----------|
| Always review generated SQL before committing | Prisma's output should be verified for correctness |
| Never edit a migration that has been applied | Applied migrations are immutable history |
| Use multi-step migrations for destructive changes | Add new → backfill → remove old (in separate deploys) |
| Test migrations against production-like data | Schema changes may behave differently with real data |
| Migration failures in CI block deployment | A broken migration must never reach production |

### ⚠️ Dangerous Operations

```bash
# 🔴 Reset the database (DESTROYS ALL DATA, development only!)
cd server && npx prisma migrate reset

# 🟡 Push schema without migration (development only, skips migration history)
cd server && npx prisma db push
```

## 🏥 Health Check Endpoints

The application exposes two health check endpoints, registered directly in `app.ts` (outside the `/api/v1` prefix).

### GET /health/live

**Purpose:** Liveness probe. Returns `200` if the process is running.

**Use for:** Container liveness checks, uptime monitors.

```json
{
  "status": "alive"
}
```

This endpoint performs no I/O. If the process can respond to HTTP, it returns 200.

### GET /health/ready

**Purpose:** Readiness probe. Returns `200` only if the database is reachable.

**Use for:** Kubernetes readiness probes, load balancer health checks.

**✅ Healthy response (200):**

```json
{
  "status": "ready",
  "checks": {
    "database": "fulfilled"
  }
}
```

**❌ Unhealthy response (503):**

```json
{
  "status": "unavailable",
  "checks": {
    "database": "rejected"
  }
}
```

The readiness check executes `SELECT 1` against PostgreSQL. If the query fails, the endpoint returns 503 Service Unavailable.

### 🐳 Docker HEALTHCHECK

The Dockerfile includes a built-in health check:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health/live || exit 1
```

| Parameter | Value | Meaning |
|-----------|-------|---------|
| `interval` | 30s | Check every 30 seconds |
| `timeout` | 5s | Fail if the check takes longer than 5 seconds |
| `retries` | 3 | Mark unhealthy after 3 consecutive failures |

### PostgreSQL Health Check (Docker Compose)

The PostgreSQL service in both compose files uses `pg_isready`:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U blessp -d blessp"]
  interval: 5s
  timeout: 5s
  retries: 5
```

The application service uses `depends_on` with `condition: service_healthy` to wait for the database before starting.

## ⏹️ Graceful Shutdown

The server implements graceful shutdown in `server/src/server.ts`.

### Shutdown Sequence

```
1. 📡 Receive SIGTERM or SIGINT signal
2. 📝 Log "Shutdown signal received"
3. 🚫 Stop accepting new HTTP connections
4. ⏳ Wait for in-flight requests to complete
5. 🔌 Disconnect from PostgreSQL (prisma.$disconnect)
6. 📝 Log "Database connection closed"
7. ✅ Exit with code 0
```

### Timeout

If the graceful shutdown does not complete within **10 seconds**, the process forcefully exits with code 1. This prevents the container from hanging indefinitely during orchestrator-initiated shutdowns.

### Signals Handled

| Signal | Source |
|--------|--------|
| `SIGTERM` | Docker stop, Kubernetes pod termination, `kill` command |
| `SIGINT` | Ctrl+C in the terminal |

## 📊 Monitoring and Observability

### Structured Logging

The application emits **structured JSON logs** via Pino. Every log entry includes:

```json
{
  "level": "info",
  "time": "2026-03-13T14:32:00.123Z",
  "service": "blessp-api",
  "version": "3.0.0",
  "env": "production",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "POST",
  "path": "/api/v1/orders",
  "statusCode": 201,
  "durationMs": 47,
  "msg": "Request completed"
}
```

### 🔒 Automatic Field Redaction

Pino is configured to automatically redact sensitive fields from log output:

- `req.headers.authorization`
- `*.password`
- `*.passwordHash`
- `*.token`

These fields appear as `[REDACTED]` in the log output, preventing accidental credential exposure.

### Log Aggregation Recommendations

| Tool | Setup |
|------|-------|
| **ELK Stack** | Ship JSON logs via Filebeat or Fluentd to Elasticsearch |
| **Datadog** | Use the Datadog Agent with JSON log parsing |
| **AWS CloudWatch** | Configure the awslogs Docker driver |
| **Grafana Loki** | Use Promtail to scrape container logs |

### 📈 Key Metrics to Monitor

| Metric | Warning Threshold | Critical Threshold |
|--------|-------------------|-------------------|
| HTTP error rate (5xx) | > 0.5% sustained 5 min | > 1% sustained 5 min |
| HTTP p95 latency | > 500ms | > 2000ms |
| HTTP p99 latency | > 1000ms | > 5000ms |
| Health check failures | 1 failure | 3 consecutive failures |
| Database connection errors | Any | Sustained over 1 min |
| Stripe webhook delivery failures | > 1% | > 5% |

### 🔔 Recommended Alerts

1. **Health check down:** External monitor polling `/health/ready` gets a non-200 response
2. **High error rate:** 5xx responses exceed 1% of total traffic over 5 minutes
3. **Slow responses:** p99 latency exceeds 2 seconds
4. **Database unreachable:** `/health/ready` returns 503
5. **Disk space low:** PostgreSQL data volume exceeding 80% capacity

## 🛡️ Security Checklist

Before deploying to production, verify every item on this list.

### 🔑 Secrets and Credentials

- [ ] `NODE_ENV` is set to `production`
- [ ] `JWT_PRIVATE_KEY_BASE64` contains a valid base64-encoded RSA private key (2048-bit minimum)
- [ ] `JWT_PUBLIC_KEY_BASE64` contains the matching base64-encoded RSA public key
- [ ] The RSA keypair is **unique** to this environment (not shared with staging)
- [ ] Database credentials are unique to this environment
- [ ] Database credentials are sourced from a secrets manager (not hardcoded in compose files)
- [ ] Stripe keys are **production** keys (not `sk_test_` prefixed)
- [ ] `STRIPE_WEBHOOK_SECRET` matches the production webhook configuration in the Stripe dashboard

### 🌐 Network and Transport

- [ ] TLS is enforced on all external endpoints (via reverse proxy or load balancer)
- [ ] HTTP (port 80) redirects to HTTPS (port 443)
- [ ] `CORS_ALLOWED_ORIGINS` is restricted to actual frontend domain(s) only
- [ ] The PostgreSQL port (5432/5433) is **not** exposed to the public internet
- [ ] Security headers are active (HSTS, X-Frame-Options, CSP, X-Content-Type-Options)

### 🐳 Container Security

- [ ] The application container runs as a non-root user (`appuser`)
- [ ] The Docker image has been scanned for vulnerabilities (Trivy, Snyk, or equivalent)
- [ ] No `CRITICAL` CVEs in the image scan results
- [ ] Base image is pinned to a specific version (or digest for maximum reproducibility)

### 🔒 Application Security

- [ ] Rate limiting is active (100 requests/15 min global, 10 requests/15 min for auth)
- [ ] Password hashing uses Argon2id (64 MB memory, 3 iterations, 4 parallelism)
- [ ] Refresh token rotation is enabled with reuse detection
- [ ] All API inputs are validated via Zod schemas before reaching the service layer
- [ ] Error responses never expose stack traces, SQL errors, or internal variable names

### 📊 Observability

- [ ] Log aggregation is configured and receiving logs
- [ ] Uptime monitoring is polling `/health/ready` from outside the infrastructure
- [ ] Alerting is configured for error rate, latency, and health check failures
- [ ] Database backups are configured and tested (see next section)

## 💾 Backup Strategy

### 📅 Database Backup Schedule

| Backup Type | Frequency | Retention |
|-------------|-----------|-----------|
| Full backup (`pg_dump`) | Daily | 30 days |
| WAL archiving (point-in-time recovery) | Continuous | 7 days |
| Weekly snapshot | Weekly | 90 days |

### Automated Backup (pg_dump)

```bash
# Create a compressed backup
pg_dump -Fc -h <host> -U <user> -d blessp > blessp_$(date +%Y%m%d_%H%M%S).dump
```

### Restore from Backup

```bash
# Restore a compressed backup
pg_restore -h <host> -U <user> -d blessp blessp_20260313_120000.dump
```

### 🏢 Managed Database Services

For managed PostgreSQL providers, use the built-in backup features:

| Provider | Feature |
|----------|---------|
| **AWS RDS** | Automated backups with point-in-time recovery (up to 35 days) |
| **Google Cloud SQL** | Automated backups with configurable retention |
| **Azure Database** | Automated backups with geo-redundant storage |
| **Supabase** | Daily backups included on paid plans |
| **Neon** | Branching and point-in-time restore |

### Backup Verification

- ✅ Test a restore from backup **monthly**
- ✅ Store backups in a **separate region** from the primary database
- ✅ Encrypt backups at rest
- ✅ Verify backup file integrity with checksums

## 🔧 Troubleshooting

### Application Fails to Start

**Symptom:** The process exits immediately with an error about invalid environment configuration.

**Cause:** One or more required environment variables are missing or fail Zod validation.

**Fix:** Check the error output for the specific field that failed. Common issues:

- `DATABASE_URL` is empty or not a valid connection string
- `JWT_PRIVATE_KEY_BASE64` or `JWT_PUBLIC_KEY_BASE64` is missing or empty
- `PORT` is not a positive integer

### Database Connection Refused

**Symptom:** `Failed to connect to the database` in the logs.

**Cause:** PostgreSQL is not running or not reachable at the `DATABASE_URL`.

**Fix:**

1. Verify PostgreSQL is running: `docker compose ps` or `pg_isready -h <host> -p <port>`
2. Check the `DATABASE_URL` format: `postgresql://user:password@host:port/database`
3. In Docker, ensure the app service uses the **container name** (`db`) as the host, not `localhost`

### Health Check Failing

**Symptom:** `/health/ready` returns 503.

**Cause:** The database is unreachable from the application.

**Fix:**

1. Check database connectivity: `docker compose exec app npx prisma db execute --stdin <<< "SELECT 1"`
2. Verify the database container is healthy: `docker compose ps`
3. Check for connection pool exhaustion in the logs

### Container Marked Unhealthy

**Symptom:** `docker compose ps` shows the app container as `unhealthy`.

**Cause:** The `HEALTHCHECK` command (`wget -qO- http://localhost:3000/health/live`) failed 3 times.

**Fix:**

1. Check application logs: `docker compose logs app`
2. Verify the app is listening on port 3000: `docker compose exec app wget -qO- http://localhost:3000/health/live`
3. Ensure no other process on the host is binding port 3000

### Stripe Webhooks Not Received

**Symptom:** Orders stay in `pending` status after successful payment.

**Cause:** Stripe cannot reach the webhook endpoint, or the signature verification is failing.

**Fix:**

1. Verify `STRIPE_WEBHOOK_SECRET` matches the webhook's signing secret in the Stripe dashboard
2. Ensure the webhook URL points to `https://yourdomain.com/api/v1/payments/webhook`
3. Check Stripe dashboard → Developers → Webhooks for delivery attempts and error codes
4. For local development, use the Stripe CLI: `stripe listen --forward-to localhost:3000/api/v1/payments/webhook`
