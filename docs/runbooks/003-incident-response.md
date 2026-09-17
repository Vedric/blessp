# 003. Incident Response

**Status**: Active
**Last reviewed**: 2026-03-14

## Summary

Defines the incident response process for the BLE$P platform, including severity
classification, communication protocols, investigation steps, mitigation strategies,
and post-mortem procedures.

## When to use this runbook

- The application is down or returning errors to customers.
- Monitoring alerts fire (error rate, latency, health check failures).
- A security vulnerability is discovered or exploited.
- A customer reports a critical issue that cannot be reproduced locally.
- Data integrity issues are detected.

## Prerequisites

- Access to application logs (Docker logs or log aggregation platform).
- Access to the monitoring dashboard (Grafana, Datadog, or equivalent).
- Access to the production host via SSH or container orchestration console.
- Access to the Stripe dashboard for payment-related incidents.
- Familiarity with the deployment runbook (`001-deployment.md`).

## Steps

### 1. Severity classification

Classify the incident immediately upon detection:

| Severity | Definition | Response time | Examples |
|----------|-----------|---------------|---------|
| **P1 (Critical)** | Service is down or data is being lost | Immediate (within 15 min) | Application unreachable, database corruption, security breach, payment processing failure |
| **P2 (Major)** | Service is degraded, significant user impact | Within 30 min | Elevated error rate (>5%), authentication failures, checkout broken, orders not processing |
| **P3 (Minor)** | Limited user impact, workaround available | Within 2 hours | Single endpoint failing, slow responses on non-critical paths, email delivery delayed |
| **P4 (Low)** | Cosmetic or non-user-facing issue | Next business day | UI rendering glitch, log formatting issue, non-critical warning in logs |

### 2. Communication protocol

#### P1 and P2 incidents

1. **Acknowledge**: Post in the incident channel within the response time window.
2. **Assign an incident lead**: One person owns coordination and communication.
3. **Status updates**: Every 15 minutes for P1, every 30 minutes for P2.
4. **Stakeholder notification**: Inform stakeholders within 30 minutes of detection.
5. **Status page**: Update the public status page if customer-facing services are affected.

#### P3 and P4 incidents

1. **Acknowledge**: Create a ticket and assign to the appropriate team member.
2. **Status updates**: As progress is made, update the ticket.

### 3. Investigation steps

Follow this sequence to identify the root cause:

#### 3.1 Check application health

```bash
# Liveness
curl -sf http://localhost:3000/health/live | jq .

# Readiness (database + Redis)
curl -sf http://localhost:3000/health/ready | jq .
```

#### 3.2 Check recent deployments

```bash
# Was there a recent deployment?
git log --oneline -10

# When was the container last started?
docker compose ps
docker inspect --format='{{.State.StartedAt}}' blessp-app-1
```

#### 3.3 Review application logs

```bash
# Recent error logs
docker compose logs --tail=200 app 2>&1 | grep '"level":"error"'

# Recent warning logs
docker compose logs --tail=200 app 2>&1 | grep '"level":"warn"'

# Full recent logs
docker compose logs --tail=500 --timestamps app
```

#### 3.4 Check infrastructure components

```bash
# PostgreSQL
docker compose exec db pg_isready -U blessp -d blessp

# Redis
docker compose exec redis redis-cli ping

# Container resource usage
docker stats --no-stream
```

#### 3.5 Check external dependencies

- **Stripe**: Check the Stripe dashboard (Developers > Logs) for API errors or webhook delivery failures.
- **DNS/CDN**: Verify DNS resolution and CDN health if applicable.

#### 3.6 Check database state

```bash
# Active connections and queries
docker compose exec db psql -U blessp -d blessp -c "
  SELECT pid, state, query_start, query
  FROM pg_stat_activity
  WHERE datname = 'blessp'
  ORDER BY query_start DESC
  LIMIT 10;
"

# Check for locks
docker compose exec db psql -U blessp -d blessp -c "
  SELECT blocked_locks.pid AS blocked_pid,
         blocking_locks.pid AS blocking_pid,
         blocked_activity.query AS blocked_query
  FROM pg_catalog.pg_locks blocked_locks
  JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
  JOIN pg_catalog.pg_locks blocking_locks
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.pid != blocked_locks.pid
  WHERE NOT blocked_locks.granted;
"
```

### 4. Mitigation strategies

Choose the appropriate mitigation based on the root cause:

#### 4.1 Rollback deployment

If the incident was caused by a recent deployment, roll back to the previous version.
See `001-deployment.md` for the rollback procedure.

```bash
# Quick rollback: restart with the previous image
docker compose up -d --no-deps app
```

#### 4.2 Database rollback

If a migration caused the issue, restore from the pre-migration backup.
See `002-database-backup-restore.md`.

#### 4.3 Restart services

For transient issues (memory leaks, connection pool exhaustion):

```bash
# Restart the application container
docker compose restart app

# Restart all services
docker compose restart
```

#### 4.4 Scale up

If the issue is load-related:

```bash
docker compose up -d --scale app=3
```

#### 4.5 Block malicious traffic

If the issue is caused by abuse or an attack:

```bash
# Block an IP at the reverse proxy level (nginx example)
# Add to nginx config: deny <ip-address>;
# Then reload: nginx -s reload
```

### 5. Resolution and recovery

1. Confirm the fix resolves the issue (health checks, error rates, user reports).
2. Monitor for 30 minutes after mitigation to ensure stability.
3. Communicate resolution to stakeholders.
4. Update the status page.

### 6. Post-mortem

Schedule a post-mortem within 48 hours of resolution for P1 and P2 incidents.
Use the following template:

```markdown
# Post-Mortem: [Incident Title]

**Date**: YYYY-MM-DD
**Duration**: HH:MM (from detection to resolution)
**Severity**: P1/P2/P3
**Incident Lead**: [Name]

## Timeline

| Time (UTC) | Event |
|-----------|-------|
| HH:MM | Issue detected via [monitoring/customer report] |
| HH:MM | Incident acknowledged, investigation started |
| HH:MM | Root cause identified |
| HH:MM | Mitigation applied |
| HH:MM | Full resolution confirmed |

## Root cause

[Detailed technical explanation of what went wrong.]

## Impact

- Users affected: [number or percentage]
- Revenue impact: [if applicable]
- Data impact: [any data loss or corruption]

## What went well

- [List of things that helped resolve the incident quickly]

## What could be improved

- [List of things that slowed down detection or resolution]

## Action items

| Action | Owner | Due date | Ticket |
|--------|-------|----------|--------|
| [Preventive measure] | [Name] | YYYY-MM-DD | TICKET-NNN |
| [Monitoring improvement] | [Name] | YYYY-MM-DD | TICKET-NNN |
```

## Verification

- [ ] Root cause has been identified and documented.
- [ ] The fix has been verified in production.
- [ ] Error rates and latency have returned to normal levels.
- [ ] Stakeholders have been notified of the resolution.
- [ ] Post-mortem has been scheduled (P1/P2 only).

## Rollback procedure

Rollback depends on the root cause. Refer to:

- Application rollback: `001-deployment.md`
- Database rollback: `002-database-backup-restore.md`
- Configuration rollback: Revert environment variables and restart the container.

## Escalation contacts

| Role | Contact | When to escalate |
|------|---------|-----------------|
| Backend Lead | Internal team channel | P1/P2: immediately |
| DevOps / Infrastructure | Internal team channel | Infrastructure failures |
| Database Administrator | Internal team channel | Data corruption, migration failures |
| Stripe Support | Stripe dashboard | Payment processing failures unresolved after 30 min |
