# Deployment Runbook

## Summary

This document covers the full deployment lifecycle for Blessp: server setup, database provisioning, application deployment, and troubleshooting.

## Prerequisites

- A Linux server (Ubuntu 22.04+ or Debian 12+ recommended)
- PHP 8.2+ with extensions: `pgsql`, `pdo_pgsql`, `mbstring`, `curl`, `xml`
- PostgreSQL 14+
- Apache with `mod_rewrite` or Nginx
- Composer (for dev dependencies only, not required in production)
- SSH access to the target server

## Server Setup

### 1. Install PHP and extensions

```bash
sudo apt update
sudo apt install php8.2 php8.2-pgsql php8.2-mbstring php8.2-curl php8.2-xml
```

### 2. Install and configure PostgreSQL

```bash
sudo apt install postgresql postgresql-client
sudo -u postgres createuser --pwprompt blessp_user
sudo -u postgres createdb -O blessp_user blessp
```

### 3. Configure the web server

**Apache:**

```apache
<VirtualHost *:443>
    ServerName shop.example.com
    DocumentRoot /var/www/blessp

    <Directory /var/www/blessp>
        AllowOverride All
        Require all granted
    </Directory>

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/shop.example.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/shop.example.com/privkey.pem

    # Security headers
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "DENY"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains"
</VirtualHost>
```

**Nginx:**

```nginx
server {
    listen 443 ssl http2;
    server_name shop.example.com;
    root /var/www/blessp;
    index index.html home.php;

    ssl_certificate /etc/letsencrypt/live/shop.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/shop.example.com/privkey.pem;

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # Deny access to sensitive files
    location ~ /\.(env|git) {
        deny all;
    }

    location ~ /(config|logger|csrf|rate_limit|api_helper|authent|order|order_item)\.php$ {
        deny all;
    }
}
```

## Application Deployment

### 1. Deploy the code

```bash
# On the server
cd /var/www/blessp
git pull origin main
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with production values:
#   DB_DSN, DB_USER, DB_PASS
#   COOKIE_SECURE=true
#   PAYPAL_CLIENT_ID
#   SMTP_* settings
#   LOG_LEVEL=warn
```

**Important:** Set `COOKIE_SECURE=true` in production (requires HTTPS).

### 3. Apply database schema and migrations

```bash
# Initial setup (first deploy only)
psql -U blessp_user -d blessp -f tests/schema.sql

# Apply migrations
psql -U blessp_user -d blessp -f migrations/001_add_indexes.sql
```

### 4. Set file permissions

```bash
# Web server user (www-data on Debian/Ubuntu) needs read access
chown -R www-data:www-data /var/www/blessp
chmod -R 755 /var/www/blessp

# Restrict .env file
chmod 640 /var/www/blessp/.env
```

### 5. Verify the deployment

```bash
# Check PHP can connect to the database
php -r "require 'config.php'; \$c = getConfig(); new PDO(\$c['db_dsn'], \$c['db_user'], \$c['db_pass']); echo 'OK';"

# Check the site responds
curl -I https://shop.example.com/
```

## Verification Checklist

After each deployment, verify:

- [ ] Homepage loads without errors
- [ ] Product listing displays correctly
- [ ] User registration works
- [ ] Login/logout flow works
- [ ] Cart operations work (add, update quantity, clear)
- [ ] Checkout flow completes with PayPal
- [ ] Admin panel is accessible to admin users
- [ ] CSRF tokens are being issued and validated
- [ ] Rate limiting is active on login/register endpoints
- [ ] Logs appear in stderr (check web server error log)

## Rollback Procedure

If a deployment introduces issues:

```bash
# Revert to the previous commit
cd /var/www/blessp
git log --oneline -5              # Identify the last good commit
git checkout <last-good-sha>      # Revert to that commit

# If a migration was applied and needs reversal,
# write a compensating SQL script and apply it:
psql -U blessp_user -d blessp -f migrations/NNN_rollback_description.sql
```

## Troubleshooting

### Application returns 500 errors

1. Check the web server error log for structured JSON log output:
   ```bash
   # Apache
   tail -50 /var/log/apache2/error.log

   # Nginx + PHP-FPM
   tail -50 /var/log/php8.2-fpm.log
   ```
2. Verify `.env` exists and has valid database credentials.
3. Test the database connection manually:
   ```bash
   psql -U blessp_user -h 127.0.0.1 -d blessp -c "SELECT 1;"
   ```

### CSRF errors on POST requests

1. Ensure PHP sessions are working (check `session.save_path` permissions).
2. Verify the frontend fetches `/csrf_token` before making POST requests.
3. Check that the `X-CSRF-Token` header is being sent.

### Rate limiting triggers unexpectedly

Rate limit counters are stored in filesystem temp files under `/tmp/blessp_rate_limit/`. To clear:

```bash
rm -rf /tmp/blessp_rate_limit/
```

In a multi-server environment, replace the filesystem rate limiter with a Redis-backed solution.

### Session cookies not being set

1. Verify `COOKIE_SECURE=true` is set only when serving over HTTPS.
2. Check that the `SameSite=Strict` policy is not blocking cross-origin requests.
3. Confirm the cookie domain matches the request domain.

### Database connection pool exhaustion

PHP uses short-lived connections by default (one per request). If you see "too many connections" errors:

1. Check `max_connections` in `postgresql.conf` (default: 100).
2. Monitor active connections: `SELECT count(*) FROM pg_stat_activity;`
3. Consider using PgBouncer as a connection pooler for high-traffic deployments.

## Monitoring

### Log output

The application writes structured JSON logs to stderr. Each log entry includes:

```json
{
  "timestamp": "2025-01-15T14:30:00Z",
  "level": "error",
  "message": "Unhandled exception",
  "requestId": "a1b2c3d4e5f6",
  "method": "POST",
  "path": "/api/orders.php",
  "context": { "exception": "..." }
}
```

Sensitive fields (passwords, tokens, API keys) are automatically redacted.

Set the `LOG_LEVEL` environment variable to control verbosity:
- `error`: production default, only failures
- `warn`: includes degraded behavior
- `info`: includes business events
- `debug`: verbose, for investigation only

### Health checks

No dedicated health endpoint exists yet. Monitor via:

```bash
# HTTP check
curl -sf https://shop.example.com/ > /dev/null && echo "UP" || echo "DOWN"

# Database check
psql -U blessp_user -h 127.0.0.1 -d blessp -c "SELECT 1;" > /dev/null 2>&1 && echo "DB OK" || echo "DB DOWN"
```

## Release Process

Releases are automated via GitHub Actions (`.github/workflows/release.yml`):

1. Merge `develop` into `main` via pull request.
2. The release pipeline reads the version from `config.php` (`$config['version']`).
3. A GitHub release is created with the version tag and auto-generated changelog.
4. Deploy the new `main` to the production server.

To bump the version, update the `'version'` value in `config.php` before merging to main.
