# 🛒 Blessp

**A modern streetwear e-commerce platform.**

Blessp is a full-featured online store built for streetwear brands, offering product browsing, cart management, secure checkout with PayPal, order tracking, and an admin panel for product and order management.

---

## ⚡ Tech Stack

| Layer | Technology |
|-------|-----------|
| 🖥️ Backend | PHP 8.2+ |
| 🗄️ Database | PostgreSQL |
| 🎨 Frontend | HTML, CSS, JavaScript (Vanilla) |
| 💳 Payments | PayPal SDK |
| 📧 Email | PHPMailer |

---

## 📋 Prerequisites

Before getting started, make sure you have:

- **PHP 8.2** or higher with extensions: `pgsql`, `pdo_pgsql`, `mbstring`, `curl`
- **PostgreSQL 14+**
- **A web server** (Apache with `mod_rewrite` or Nginx)
- **Git**
- **Composer** (optional, for dependency management)

---

## 🚀 Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-username/blessp.git
cd blessp
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your local settings:

```env
DB_DSN=pgsql:host=127.0.0.1;port=5432;dbname=blessp
DB_USER=your_db_user
DB_PASS=your_db_password

COOKIE_SECURE=false

PAYPAL_CLIENT_ID=your_paypal_client_id
```

### 3. Set up the database

Create the PostgreSQL database and apply the schema:

```bash
createdb blessp
psql -d blessp -f schema.sql   # if a schema file is available
```

### 4. Configure your web server

Point your web server's document root to the project directory. For Apache, ensure `mod_rewrite` is enabled. For Nginx, configure URL rewriting as needed.

### 5. Open in your browser

Navigate to `http://localhost/blessp` (or your configured URL).

---

## 📁 Project Structure

```
blessp/
├── admin/              # 🔧 Admin panel (products, orders management)
├── api/                # 🔌 Backend API endpoints
├── css/                # 🎨 Stylesheets
├── helper/             # 🛠️ Utility and helper functions
├── img/                # 🖼️ Static images and assets
├── js/                 # ⚙️ Client-side JavaScript
├── mailer/             # 📧 PHPMailer library and email sending
├── profile/            # 👤 User profile and account pages
├── video/              # 🎬 Video assets
├── config.php          # ⚙️ Application configuration
├── index.html          # 🏠 Landing page
├── home.php            # 🏠 Homepage
├── shop.php            # 🛍️ Product listing
├── product.php         # 📦 Single product page
├── checkout.php        # 💳 Checkout flow
├── order.php           # 📋 Order details
├── order_recap.php     # 📄 Order summary
├── signin.php          # 🔑 Sign in page
├── signup.php          # 📝 Registration page
├── .env.example        # 📄 Environment variables template
└── .github/            # 🔄 CI/CD workflows and templates
```

---

## 🔧 Development Workflow

### Branch Strategy

We use a `main` / `develop` branching model:

```
main (stable releases)
 └── develop (integration)
      └── feature/*, fix/*, refactor/*
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

### Running Locally

```bash
# Quick syntax check on all PHP files
find . -name "*.php" -not -path "./mailer/*" -not -path "./vendor/*" -exec php -l {} \;
```

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(cart): add quantity update functionality
fix(auth): resolve session expiration issue
docs(readme): update installation steps
```

---

## 🧪 Testing

```bash
# PHP syntax check
find . -name "*.php" -not -path "./mailer/*" -not -path "./vendor/*" -exec php -l {} \;

# Run PHPUnit (when configured)
vendor/bin/phpunit
```

---

## 🚢 Deployment

Releases are automatically created via GitHub Actions when code is merged to `main`. The version is read from `config.php` (currently `1.0.6`).

---

## 📄 License

This project is proprietary. All rights reserved.

<!-- Update this section with the appropriate license when decided. -->
