# Blessp

A streetwear e-commerce platform built with PHP 8.2 and PostgreSQL.

Blessp is a full-featured online store offering product browsing, cart management, secure checkout with PayPal, order tracking, and an admin panel for product and order management.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | PHP 8.2+ (vanilla, no framework) |
| Database | PostgreSQL 16 |
| Frontend | HTML, CSS, JavaScript |
| Payments | PayPal SDK |
| Email | PHPMailer |
| CI/CD | GitHub Actions |

## Prerequisites

- **PHP 8.2** or higher with extensions: `pgsql`, `pdo_pgsql`, `mbstring`, `curl`, `xml`
- **PostgreSQL 14+**
- **Composer** (for dev dependencies: PHPUnit, PHPStan)
- **A web server** (Apache with `mod_rewrite` or Nginx)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-username/blessp.git
cd blessp

# Install dev dependencies
composer install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials and settings

# Create the database and apply the schema
createdb blessp
psql -d blessp -f tests/schema.sql

# Apply indexes
psql -d blessp -f migrations/001_add_indexes.sql

# Point your web server document root to the project directory
# Navigate to http://localhost/blessp
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_DSN` | PDO connection string | `pgsql:host=127.0.0.1;port=5432;dbname=blessp` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASS` | Database password | (empty) |
| `COOKIE_SECURE` | Secure flag on session cookies | `false` |
| `PAYPAL_CLIENT_ID` | PayPal client ID for payments | (required for checkout) |
| `SMTP_HOST` | SMTP server for transactional emails | — |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | — |
| `SMTP_PASS` | SMTP password | — |
| `SMTP_FROM` | Sender email address | — |
| `SMTP_FROM_NAME` | Sender display name | `Blessp` |
| `LOG_LEVEL` | Minimum log level (`debug`, `info`, `warn`, `error`) | `info` |

## Project Structure

```
blessp/
├── api/                    # Modular API routers and business logic
│   ├── helper.php          # Shared router setup, pagination helpers
│   ├── products.php        # Product route dispatcher
│   ├── products_fctn.php   # Product business logic
│   ├── orders.php          # Order route dispatcher
│   ├── orders_fctn.php     # Order business logic
│   ├── address.php         # Address route dispatcher
│   └── address_fctn.php    # Address business logic
├── admin/                  # Admin panel (product and order management)
├── css/                    # Stylesheets
├── js/                     # Client-side JavaScript
├── img/                    # Static images
├── helper/                 # Frontend utility functions
├── mailer/                 # PHPMailer library and email sending
├── profile/                # User profile and account pages
├── migrations/             # Database migration scripts
├── tests/                  # PHPUnit test suites (unit, integration, e2e)
├── docs/                   # Project documentation
│   ├── api.md              # API endpoint reference
│   ├── database.md         # Database schema documentation
│   └── deployment.md       # Deployment runbook
├── .github/workflows/      # CI/CD pipelines
│   ├── ci.yml              # Lint, static analysis, tests
│   └── release.yml         # Automated releases on merge to main
├── config.php              # Application configuration and .env loader
├── api_helper.php          # Shared functions (auth, JSON response, PDO)
├── csrf.php                # CSRF token generation and validation
├── rate_limit.php          # IP-based rate limiting
├── logger.php              # Structured JSON logger with redaction
├── authent.php             # Authentication endpoint handlers
├── order.php               # Order domain class (Shop\Order)
├── order_item.php          # OrderItem domain class (Shop\OrderItem)
├── api.php                 # Legacy monolithic API router
├── index.html              # Landing page
├── home.php                # Homepage
├── shop.php                # Product listing
├── product.php             # Single product page
├── checkout.php            # Checkout flow
├── signin.php              # Sign in page
├── signup.php              # Registration page
└── CONTRIBUTING.md         # Contribution guidelines
```

## Testing

The project uses PHPUnit 10.5 with three test suites:

```bash
# Run all tests
vendor/bin/phpunit

# Run only unit tests
vendor/bin/phpunit --testsuite unit

# Run integration tests (requires PostgreSQL)
vendor/bin/phpunit --testsuite integration

# Run end-to-end tests (requires PostgreSQL)
vendor/bin/phpunit --testsuite e2e
```

Static analysis with PHPStan (level 5):

```bash
vendor/bin/phpstan analyse
```

PHP syntax check:

```bash
find . -name "*.php" -not -path "./mailer/*" -not -path "./vendor/*" -exec php -l {} \;
```

## CI/CD

Every pull request to `develop` or `main` triggers the CI pipeline:

1. PHP syntax lint (all files except vendor and mailer)
2. PHPStan static analysis (level 5)
3. Unit tests
4. Integration tests (against PostgreSQL 16)
5. E2E tests
6. Composer security audit

Merging to `main` triggers the release pipeline, which creates a GitHub release tagged with the version from `config.php`.

## Security Features

- **Session-based authentication** with secure cookie settings (HttpOnly, SameSite=Strict)
- **CSRF protection** via Synchronizer Token Pattern on all POST endpoints
- **Rate limiting** on authentication endpoints (IP-based with per-account lockout)
- **Input validation** with length limits on all user inputs
- **Parameterized queries** throughout (no SQL string concatenation)
- **Structured logging** with automatic redaction of sensitive fields (passwords, tokens, keys)
- **Security headers** (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)

## Documentation

- [API Reference](docs/api.md): complete endpoint documentation
- [Database Schema](docs/database.md): tables, columns, indexes
- [Deployment Runbook](docs/deployment.md): setup, deploy, troubleshoot
- [Contributing](CONTRIBUTING.md): branch naming, commits, PR process

## Development Workflow

We use a `main` / `develop` branching model with Conventional Commits:

```
main (stable releases)
 └── develop (integration)
      └── feature/*, fix/*, refactor/*
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.

## License

This project is proprietary. All rights reserved.
