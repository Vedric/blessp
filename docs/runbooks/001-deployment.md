# 001. Production Deployment

**Status**: Active
**Last reviewed**: 2026-03-14

## Summary

Step-by-step procedure for deploying a new version of the BLE$P application to production.
Covers pre-deployment validation, image build, database migration, container rollout,
and post-deployment monitoring.

## When to use this runbook

- Deploying a new release to production after merging to `main`.
- Deploying a hotfix to production.
- Re-deploying the current version after a configuration change.

## Prerequisites

- SSH access to the production host (or access to the container orchestration platform).
- Docker and Docker Compose installed on the target host.
- The `.env` file on the production host contains all required environment variables
  (see `docs/deployment.md` for the full list).
- Access to the container registry (if using a remote registry).
- Database credentials with migration privileges.

## Steps

### 1. Pre-deployment checks

Verify that all CI checks have passed on the `main` branch:

```bash
# Confirm the branch is clean and up to date
git checkout main
git pull origin main
git log --oneline -5
```

Confirm the following are green:

- Linting (`npm run lint`)
- Type checking (`npm run typecheck`)
- Unit tests (`npm test`)
- Integration tests (`npm run test:integration`)
- Docker image build
- Security scan (Trivy, no CRITICAL CVEs)

Verify code review approval on the pull request.

### 2. Tag the release

```bash
git tag -a v3.x.x -m "Release v3.x.x"
git push origin v3.x.x
```

### 3. Build the Docker image

```bash
# Build the production image
docker compose build app

# If using a remote registry, tag and push
docker tag blessp-app:latest registry.example.com/blessp-app:$(git rev-parse --short HEAD)
docker push registry.example.com/blessp-app:$(git rev-parse --short HEAD)
```

### 4. Back up the database before migration

```bash
pg_dump -Fc -h <db-host> -U <db-user> -d blessp \
  > blessp_pre_deploy_$(date +%Y%m%d_%H%M%S).dump
```

Verify the backup file is non-empty:

```bash
ls -lh blessp_pre_deploy_*.dump
```

### 5. Run database migrations

```bash
docker compose exec app npx prisma migrate deploy
```

Check migration status:

```bash
docker compose exec app npx prisma migrate status
```

If the migration fails, stop the deployment and refer to the rollback procedure below.

### 6. Deploy the new container

```bash
# Pull the latest image (if using a registry)
docker compose pull app

# Restart the app container with zero downtime
docker compose up -d --no-deps --build app
```

If running behind a load balancer, perform a rolling restart:

```bash
# Scale up new instances before draining old ones
docker compose up -d --scale app=2
# Wait for the new instance to pass health checks, then scale back down
docker compose up -d --scale app=1
```

### 7. Verify health checks

```bash
# Liveness probe
curl -sf http://localhost:3000/health/live | jq .

# Readiness probe (database + Redis connectivity)
curl -sf http://localhost:3000/health/ready | jq .
```

Expected responses:

```json
{"status": "alive"}
{"status": "ready", "checks": {"database": "fulfilled"}}
```

### 8. Post-deployment monitoring

Monitor the following for 15 minutes after deployment:

- **Error rate**: 5xx responses should remain below 0.5%.
- **Response latency**: p95 should remain below 500ms.
- **Health checks**: `/health/ready` should return 200 consistently.
- **Application logs**: Watch for unexpected error-level entries.

```bash
# Tail application logs
docker compose logs -f --tail=100 app
```

Check for any increase in error volume:

```bash
# If using structured logging, filter for error-level entries
docker compose logs app 2>&1 | grep '"level":"error"' | tail -20
```

## Verification

- [ ] `/health/live` returns 200
- [ ] `/health/ready` returns 200
- [ ] No new error-level log entries in the first 15 minutes
- [ ] Key user flows work (login, browse products, add to cart, checkout)
- [ ] Stripe webhook delivery is functioning (check Stripe dashboard)

## Rollback procedure

### If the migration failed

1. Restore from the pre-deployment backup:

```bash
pg_restore -h <db-host> -U <db-user> -d blessp --clean \
  blessp_pre_deploy_<timestamp>.dump
```

2. Redeploy the previous image:

```bash
docker compose up -d --no-deps app
```

### If the application is unhealthy after deployment

1. Identify the previous working image tag:

```bash
docker images blessp-app --format "{{.Tag}} {{.CreatedAt}}" | head -5
```

2. Roll back to the previous image:

```bash
# Update docker-compose.yml or set the image tag explicitly
docker compose up -d --no-deps app
```

3. Verify health checks pass with the rolled-back version.

4. Investigate the failure using application logs and open an incident if needed.

## Escalation contacts

| Role | Contact |
|------|---------|
| Backend Lead | Internal team channel |
| DevOps / Infrastructure | Internal team channel |
| Database Administrator | Internal team channel |
