# 005. Secret Rotation

**Status**: Active
**Last reviewed**: 2026-03-14

## Summary

Procedures for rotating all application secrets on a regular schedule or in response
to a suspected compromise. Covers JWT signing keys, database passwords, Stripe API keys,
and Redis passwords.

## When to use this runbook

- Scheduled rotation (every 90 days or per vendor recommendation).
- A secret is suspected or confirmed to have been exposed.
- A team member with access to secrets leaves the organization.
- A security audit requires proof of rotation procedures.

## Prerequisites

- `openssl` installed for key generation.
- Access to the production host and environment variable configuration.
- Access to the secrets manager (HashiCorp Vault, AWS Secrets Manager, or equivalent).
- Ability to perform a rolling restart of the application.
- A maintenance window for rotations that require brief downtime (database password).

## Steps

### 1. JWT signing key rotation (RS256)

The application uses RS256 (asymmetric) JWT signing. Access tokens have a 15-minute TTL,
and refresh tokens have a 7-day TTL. Key rotation must account for tokens signed with
the old key that are still valid.

#### 1.1 Generate a new RSA keypair

```bash
# Generate a 2048-bit RSA private key
openssl genrsa -out jwt_private_new.pem 2048

# Extract the public key
openssl rsa -in jwt_private_new.pem -pubout -out jwt_public_new.pem
```

#### 1.2 Base64-encode the keys

```bash
# Encode for environment variable injection
cat jwt_private_new.pem | base64 -w 0 > jwt_private_new_b64.txt
cat jwt_public_new.pem | base64 -w 0 > jwt_public_new_b64.txt
```

#### 1.3 Deploy with both keys (transition period)

During the transition, the application must accept tokens signed with the old key
while issuing new tokens with the new key. If the application supports a
`JWT_OLD_PUBLIC_KEY_BASE64` variable, set it:

```bash
# In the environment configuration:
JWT_PRIVATE_KEY_BASE64=<new-private-key-base64>
JWT_PUBLIC_KEY_BASE64=<new-public-key-base64>
JWT_OLD_PUBLIC_KEY_BASE64=<old-public-key-base64>
```

If dual-key verification is not supported, coordinate the rotation as follows:

1. Deploy the new keys.
2. All existing access tokens (15-minute TTL) will expire naturally within 15 minutes.
3. Users with active refresh tokens will re-authenticate on their next refresh,
   receiving tokens signed with the new key.
4. Monitor for `401` responses in the 15 minutes following rotation.

#### 1.4 Restart the application

```bash
docker compose up -d --no-deps app
```

#### 1.5 Remove the old key

After the transition period (at least 15 minutes for access tokens, up to 7 days for
refresh tokens if dual-key is supported), remove the old public key:

```bash
# Remove JWT_OLD_PUBLIC_KEY_BASE64 from the environment
# Restart the application
docker compose up -d --no-deps app
```

#### 1.6 Clean up key files

```bash
# Securely delete the key files from the generation machine
shred -u jwt_private_new.pem jwt_public_new.pem
shred -u jwt_private_new_b64.txt jwt_public_new_b64.txt
```

### 2. Database password rotation

#### 2.1 Create a backup before rotation

```bash
pg_dump -Fc -h <db-host> -U <db-user> -d blessp \
  > blessp_pre_rotation_$(date +%Y%m%d_%H%M%S).dump
```

#### 2.2 Generate a new password

```bash
openssl rand -base64 48
```

#### 2.3 Update the database password

```bash
# Connect to PostgreSQL as a superuser
docker compose exec db psql -U postgres -c \
  "ALTER USER blessp WITH PASSWORD '<new-password>';"
```

#### 2.4 Update the application environment

Update `DATABASE_URL` in the environment configuration:

```
DATABASE_URL=postgresql://blessp:<new-password>@db:5432/blessp
```

#### 2.5 Restart the application

```bash
docker compose up -d --no-deps app
```

#### 2.6 Verify connectivity

```bash
curl -sf http://localhost:3000/health/ready | jq .
# Expected: {"status": "ready", "checks": {"database": "fulfilled"}}
```

### 3. Stripe API key rotation

#### 3.1 Generate new keys in Stripe

1. Log in to the Stripe dashboard.
2. Navigate to Developers > API Keys.
3. Roll the secret key (this generates a new key and keeps the old one active
   for 24 hours).
4. If rotating the webhook signing secret, create a new webhook endpoint or
   roll the existing secret.

#### 3.2 Update the application environment

```bash
STRIPE_SECRET_KEY=<new-stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<new-webhook-signing-secret>
```

#### 3.3 Restart the application

```bash
docker compose up -d --no-deps app
```

#### 3.4 Verify Stripe integration

- Create a test payment intent to confirm the new secret key works.
- Trigger a test webhook event from the Stripe dashboard to confirm the new
  webhook secret is accepted.
- Monitor for `Stripe webhook signature verification failed` in application logs.

#### 3.5 Revoke the old key

After confirming the new key works, revoke the old secret key in the Stripe dashboard
(if not automatically expired).

### 4. Redis password rotation

#### 4.1 Set a new password in Redis

```bash
docker compose exec redis redis-cli CONFIG SET requirepass "<new-password>"
```

#### 4.2 Update the application environment

Update `REDIS_URL` to include the new password:

```
REDIS_URL=redis://:<new-password>@redis:6379
```

#### 4.3 Restart the application

```bash
docker compose up -d --no-deps app
```

#### 4.4 Verify connectivity

```bash
# Test Redis connectivity with the new password
docker compose exec redis redis-cli -a "<new-password>" ping
# Expected: PONG

# Verify application health
curl -sf http://localhost:3000/health/ready | jq .
```

#### 4.5 Persist the Redis configuration

Update the Redis configuration file or Docker Compose environment to ensure
the password persists across restarts:

```yaml
# docker-compose.yml (redis service)
command: redis-server --requirepass <new-password>
```

Restart Redis:

```bash
docker compose up -d --no-deps redis
```

## Verification

After each rotation, verify the following:

- [ ] `/health/live` returns 200.
- [ ] `/health/ready` returns 200 (database connectivity confirmed).
- [ ] No authentication errors in application logs.
- [ ] Users can log in and obtain new tokens (JWT rotation).
- [ ] Payments can be processed (Stripe rotation).
- [ ] Cache reads and writes work (Redis rotation).
- [ ] BullMQ worker is running (Redis rotation).
- [ ] The old secret has been revoked or removed from all environments.
- [ ] Key material has been securely deleted from the generation machine.

## Rotation schedule

| Secret | Rotation frequency | Last rotated | Next rotation |
|--------|-------------------|-------------|--------------|
| JWT RS256 keypair | Every 90 days | YYYY-MM-DD | YYYY-MM-DD |
| Database password | Every 90 days | YYYY-MM-DD | YYYY-MM-DD |
| Stripe secret key | Every 90 days | YYYY-MM-DD | YYYY-MM-DD |
| Stripe webhook secret | Every 90 days | YYYY-MM-DD | YYYY-MM-DD |
| Redis password | Every 90 days | YYYY-MM-DD | YYYY-MM-DD |

Update this table after each rotation.

## Rollback procedure

### JWT key rotation rollback

If the new key causes widespread authentication failures:

1. Revert to the old `JWT_PRIVATE_KEY_BASE64` and `JWT_PUBLIC_KEY_BASE64`.
2. Restart the application.
3. All tokens signed with the new key will become invalid. Users will need to re-authenticate.

### Database password rollback

1. Reset the password to the previous value:

```bash
docker compose exec db psql -U postgres -c \
  "ALTER USER blessp WITH PASSWORD '<old-password>';"
```

2. Revert `DATABASE_URL` in the environment.
3. Restart the application.

### Stripe key rollback

If the old key has not been revoked, revert `STRIPE_SECRET_KEY` to the old value
and restart. If the old key was revoked, contact Stripe support.

### Redis password rollback

```bash
docker compose exec redis redis-cli -a "<new-password>" CONFIG SET requirepass "<old-password>"
```

Revert `REDIS_URL` and restart the application.

## Escalation contacts

| Role | Contact |
|------|---------|
| Backend Lead | Internal team channel |
| DevOps / Infrastructure | Internal team channel |
| Security Lead | Internal team channel |
