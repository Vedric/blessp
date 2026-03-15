# 002. Database Backup and Restore

**Status**: Active
**Last reviewed**: 2026-03-14

## Summary

Procedures for creating, verifying, and restoring PostgreSQL database backups.
Covers automated daily backups, manual pre-migration backups, full restores,
and point-in-time recovery using WAL archiving.

## When to use this runbook

- Performing a scheduled backup verification (monthly).
- Creating a manual backup before a risky migration or schema change.
- Restoring from backup after data loss, corruption, or a failed migration.
- Setting up or troubleshooting WAL-based point-in-time recovery.

## Prerequisites

- `pg_dump` and `pg_restore` (version 16+) installed on the machine performing the backup.
- Database credentials with sufficient privileges (`SELECT` for backup, superuser or owner for restore).
- Adequate disk space for the backup file (typically 2x the database size for safety).
- For WAL archiving: access to the WAL archive storage location (S3 bucket, NFS share, or local path).

## Steps

### 1. Manual full backup (pg_dump)

Create a compressed custom-format backup:

```bash
pg_dump -Fc \
  -h <db-host> \
  -p <db-port> \
  -U <db-user> \
  -d blessp \
  > blessp_$(date +%Y%m%d_%H%M%S).dump
```

Verify the backup file:

```bash
# Check file size (should be non-zero)
ls -lh blessp_*.dump

# List the contents without restoring
pg_restore -l blessp_<timestamp>.dump | head -20
```

### 2. Automated daily backup

Set up a cron job for automated daily backups:

```bash
# Edit the crontab
crontab -e
```

Add the following entry (runs daily at 02:00 UTC):

```cron
0 2 * * * /usr/local/bin/pg_dump -Fc -h <db-host> -U <db-user> -d blessp > /backups/blessp_$(date +\%Y\%m\%d_\%H\%M\%S).dump 2>> /var/log/blessp-backup.log
```

Implement backup rotation to enforce retention policy:

```bash
# Delete backups older than 30 days
find /backups/ -name "blessp_*.dump" -mtime +30 -delete
```

### 3. Pre-migration backup

Always create a backup before running migrations in production:

```bash
# Name the backup to indicate it precedes a migration
pg_dump -Fc \
  -h <db-host> \
  -U <db-user> \
  -d blessp \
  > blessp_pre_migration_$(date +%Y%m%d_%H%M%S).dump

# Verify immediately
pg_restore -l blessp_pre_migration_*.dump | tail -5
```

### 4. Full restore from backup

**Warning**: This operation replaces all data in the target database.

```bash
# Option A: Restore into an existing database (drops and recreates objects)
pg_restore \
  -h <db-host> \
  -U <db-user> \
  -d blessp \
  --clean \
  --if-exists \
  blessp_<timestamp>.dump

# Option B: Restore into a fresh database
createdb -h <db-host> -U <db-user> blessp_restored
pg_restore \
  -h <db-host> \
  -U <db-user> \
  -d blessp_restored \
  blessp_<timestamp>.dump
```

After restoring, re-run Prisma client generation if the schema has changed:

```bash
cd server && npx prisma generate
```

### 5. Point-in-time recovery with WAL archiving

#### 5.1 Enable WAL archiving (postgresql.conf)

```ini
wal_level = replica
archive_mode = on
archive_command = 'cp %p /wal-archive/%f'
```

Restart PostgreSQL after changing these settings.

#### 5.2 Create a base backup

```bash
pg_basebackup \
  -h <db-host> \
  -U <replication-user> \
  -D /backups/base_$(date +%Y%m%d) \
  -Ft -z -P
```

#### 5.3 Recover to a specific point in time

1. Stop PostgreSQL on the recovery target.
2. Replace the data directory with the base backup.
3. Create a `recovery.signal` file in the data directory.
4. Configure `postgresql.conf`:

```ini
restore_command = 'cp /wal-archive/%f %p'
recovery_target_time = '2026-03-14 10:30:00 UTC'
recovery_target_action = 'promote'
```

5. Start PostgreSQL. It will replay WAL segments up to the specified time.
6. Verify the recovery, then remove `recovery.signal`.

### 6. Docker Compose environment

For the Docker Compose deployment, run backup commands via `docker compose exec`:

```bash
# Backup from inside the db container
docker compose exec db pg_dump -Fc -U blessp -d blessp > blessp_$(date +%Y%m%d_%H%M%S).dump

# Restore into the db container
cat blessp_<timestamp>.dump | docker compose exec -T db pg_restore -U blessp -d blessp --clean --if-exists
```

## Verification

After every restore, run the following checks:

```bash
# Check table row counts
docker compose exec db psql -U blessp -d blessp -c "
  SELECT 'users' AS tbl, COUNT(*) FROM users
  UNION ALL SELECT 'products', COUNT(*) FROM products
  UNION ALL SELECT 'orders', COUNT(*) FROM orders
  UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
  UNION ALL SELECT 'refresh_tokens', COUNT(*) FROM refresh_tokens;
"

# Verify Prisma migration state
cd server && npx prisma migrate status

# Run the readiness health check
curl -sf http://localhost:3000/health/ready | jq .

# Smoke test: fetch products
curl -sf http://localhost:3000/api/v1/products | jq '.data | length'
```

- [ ] Row counts match expected values (compare with pre-backup counts if available).
- [ ] No orphaned records (foreign key constraints are intact).
- [ ] Prisma migration history is consistent.
- [ ] Application health check returns 200.

## Rollback procedure

If a restore produces incorrect data or breaks the application:

1. Stop the application to prevent further writes:

```bash
docker compose stop app
```

2. Restore from an earlier known-good backup.
3. Re-verify using the checks above.
4. Restart the application.

## Escalation contacts

| Role | Contact |
|------|---------|
| Database Administrator | Internal team channel |
| Backend Lead | Internal team channel |
| DevOps / Infrastructure | Internal team channel |
