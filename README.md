# 🏪 BLE$$ P

> Premium streetwear, engineered from code to closet.

BLE$$ P is a **full-stack e-commerce platform** purpose-built for a luxury streetwear brand. It pairs a modern React storefront (featuring fluid animations and a dark, editorial aesthetic) with a hardened Express API backed by PostgreSQL. The entire stack is written in TypeScript, containerised with Docker, and wired for Stripe payment processing.

---

## 📋 Table of Contents

1. [🛠️ Tech Stack](#️-tech-stack)
2. [📦 Prerequisites](#-prerequisites)
3. [🚀 Quick Start](#-quick-start)
4. [🐳 Docker Setup](#-docker-setup)
5. [📁 Project Structure](#-project-structure)
6. [📡 API Endpoints](#-api-endpoints)
7. [🧪 Testing](#-testing)
8. [🔒 Security Features](#-security-features)
9. [📊 Architecture Overview](#-architecture-overview)
10. [🎨 Frontend Stack and Design System](#-frontend-stack-and-design-system)
11. [📝 Git Conventions](#-git-conventions)
12. [🚢 Deployment](#-deployment)
13. [📄 License](#-license)

---

## 🛠️ Tech Stack

### Backend ⚙️

| Technology | Version | Purpose |
|---|---|---|
| **TypeScript** | 5.8 | Type-safe language for the entire server |
| **Express** | 5.1 | HTTP framework for routing and middleware |
| **Prisma ORM** | 6.5 | Type-safe database access, migrations, and schema management |
| **PostgreSQL** | 16 (Alpine) | Relational database with JSONB, array columns, and ACID transactions |
| **Redis** | 7 (Alpine) | Optional: product caching and BullMQ email queue |
| **Zod** | 3.24 | Runtime schema validation for all request inputs |
| **Pino** | 9.6 | Structured JSON logging with field redaction |
| **Stripe** | 17.7 | Payment processing (PaymentIntents + webhook verification) |
| **ioredis** | 5.x | Redis client (cache and BullMQ transport) |
| **BullMQ** | 5.x | Background job queue for email delivery |
| **Argon2** | 0.41 | Password hashing with Argon2id (OWASP recommended) |
| **jsonwebtoken** | 9.0 | JWT signing and verification (RS256) |
| **Helmet** | 8.1 | HTTP security header hardening |
| **express-rate-limit** | 7.5 | Per-IP rate limiting (global + per-endpoint) |
| **cookie-parser** | 1.4 | Cookie parsing middleware |
| **uuid** | 11.1 | UUID v4 generation for request IDs |

### Frontend 🎨

| Technology | Version | Purpose |
|---|---|---|
| **React** | 19.1 | Component-based UI library |
| **Vite** | 6.3 | Lightning-fast dev server and build tool |
| **Tailwind CSS** | 3.4 | Utility-first styling framework |
| **Framer Motion** | 12.5 | Declarative animations and page transitions |
| **React Router** | 7.4 | Client-side routing |
| **Stripe Elements** | 5.9 / 3.5 | PCI-compliant payment form components |
| **Lucide React** | 0.477 | Consistent SVG icon library |
| **react-hot-toast** | 2.5 | Lightweight toast notifications |

### Infrastructure 🏗️

| Technology | Purpose |
|---|---|
| **Docker** | Multi-stage production container (non-root, healthcheck) |
| **Docker Compose** | Local development and production orchestration |
| **Node.js 22** (Alpine) | Runtime for both dev and production containers |
| **GitHub Actions** | CI/CD pipeline (lint, typecheck, test, build, security audit, release) |

### Dev Tooling 🔧

| Tool | Purpose |
|---|---|
| **Jest** | Unit and integration testing (80% coverage threshold) |
| **ts-jest** | TypeScript test transformer |
| **Supertest** | HTTP assertion library for integration tests |
| **tsx** | TypeScript execution with hot reload (`tsx watch`) |
| **concurrently** | Parallel script runner for dev mode |
| **Prisma Studio** | Visual database browser (`npm run db:studio`) |

---

## 📦 Prerequisites

Before you begin, make sure you have the following installed:

| Requirement | Minimum Version | Check Command |
|---|---|---|
| **Node.js** | 22.x | `node --version` |
| **npm** | 10.x | `npm --version` |
| **PostgreSQL** | 16.x | `psql --version` |
| **Redis** *(optional)* | 7.x | `redis-cli --version` |
| **Docker** *(optional)* | 24.x | `docker --version` |
| **Docker Compose** *(optional)* | 2.x | `docker compose version` |

> 💡 **Tip:** If you use the Docker Compose setup, you do not need a local PostgreSQL or Redis installation. The Compose stack provisions its own database and Redis containers.

💡 **Redis is optional.** The application works fully without it. When `REDIS_URL` is not set, product caching is skipped and order confirmation emails are sent synchronously instead of via the BullMQ queue.

---

## 🚀 Quick Start

### Step 1: Clone the repository

```bash
git clone <repository-url>
cd blessp
```

### Step 2: Install dependencies

There are three `package.json` files (root, server, client). Install all of them:

```bash
# Root dependencies (concurrently)
npm install

# Server dependencies
cd server && npm install && cd ..

# Client dependencies
cd client && npm install && cd ..
```

### Step 3: Configure environment variables

```bash
cp server/.env.example server/.env
```

Open `server/.env` in your editor and fill in the values:

```env
# Database (update with your local PostgreSQL credentials)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/blessp?schema=public

# JWT (RS256 asymmetric keys, base64-encoded PEM)
JWT_PRIVATE_KEY_BASE64=<base64-encoded-RSA-private-key-PEM>
JWT_PUBLIC_KEY_BASE64=<base64-encoded-RSA-public-key-PEM>

# Redis (optional, enables caching and background email queue)
REDIS_URL=redis://localhost:6379

# Stripe (use test keys for development)
STRIPE_SECRET_KEY=sk_test_changeme
STRIPE_WEBHOOK_SECRET=whsec_changeme
```

> 📝 See the full [Environment Variables Reference](docs/deployment.md) for every configurable option.

### Step 4: Create the database

```bash
# If using a local PostgreSQL installation
createdb blessp
```

### Step 5: Generate the Prisma client and push the schema

```bash
cd server
npx prisma generate
npx prisma db push
cd ..
```

### Step 6: Seed the database with sample products

```bash
npm run db:seed
```

This creates:
- 🔑 An admin user (`admin@blessp.com` / `Admin123456!`)
- 👕 7 products (hoodies, pants, and sets in black, blue, and pink)

### Step 7: Start the development servers

```bash
npm run dev
```

This launches both servers concurrently:
- 🖥️ **API server** at `http://localhost:3000` (with hot reload via `tsx watch`)
- 🌐 **Vite dev server** at `http://localhost:5173` (with HMR and API proxy)

> The Vite dev server proxies all `/api` requests to the Express backend, so both servers work together seamlessly during development.

---

## 🐳 Docker Setup

### 🔧 Development Mode (with hot reload)

The `docker-compose.dev.yml` file sets up a full development environment with live code reloading:

```bash
docker compose -f docker-compose.dev.yml up
```

This starts **three services**:

| Service | Port | Description |
|---|---|---|
| `db` | 5433 (host) → 5432 | PostgreSQL 16 with health checks |
| `server` | 3000 | Express API with `tsx watch` hot reload |
| `client` | 5173 | Vite dev server with HMR |

The server and client source directories are bind-mounted into the containers, so code changes are reflected immediately. Node modules are stored in named volumes (`server_node_modules`, `client_node_modules`) for performance.

On first start, the server container automatically:
1. Installs dependencies (`npm install`)
2. Generates the Prisma client
3. Pushes the database schema
4. Seeds the database
5. Starts the dev server

```bash
# Stop the dev stack
docker compose -f docker-compose.dev.yml down

# Stop and remove all data (including the database volume)
docker compose -f docker-compose.dev.yml down -v
```

### 🚀 Production Mode

The `docker-compose.yml` file builds and runs the optimised production image:

```bash
docker compose up --build -d
```

This starts **three services**:

| Service | Port | Description |
|---|---|---|
| `db` | 5433 (host) → 5432 | PostgreSQL 16 with persistent volume |
| `redis` | 6379 | Redis 7 Alpine (caching, BullMQ email queue) |
| `app` | 3000 | Production app (API + static client files + BullMQ worker) |

The production Dockerfile uses a **three-stage build**:

1. **deps** stage: installs server and client npm dependencies
2. **builder** stage: generates Prisma client, compiles TypeScript, builds the Vite client
3. **production** stage: copies only the compiled output and node_modules into a minimal Alpine image

Key production container features:
- 🔐 Runs as a non-root user (`appuser`)
- ❤️ Built-in `HEALTHCHECK` polling `/health/live` every 30 seconds
- 📦 Single container serves both the API and the compiled React SPA
- ♻️ Automatic restart (`unless-stopped` policy)

```bash
# Run migrations inside the production container
docker compose exec app npx prisma migrate deploy

# Seed the database (first deployment only)
docker compose exec app npx tsx prisma/seed.ts

# View application logs
docker compose logs -f app

# Rebuild and restart after code changes
docker compose up --build -d
```

---

## 📁 Project Structure

```
blessp/
├── 📄 package.json                    Root scripts (dev, build, test, lint)
├── 📄 docker-compose.yml              Production Docker Compose
├── 📄 docker-compose.dev.yml          Development Docker Compose (with hot reload)
├── 📄 Dockerfile                      Multi-stage production build
├── 📄 .dockerignore                   Files excluded from Docker context
├── 📄 .env.example                    Template for environment variables
├── 📄 .gitignore                      Git ignore rules
│
├── 📂 server/                         Express API server
│   ├── 📄 package.json                Server dependencies and scripts
│   ├── 📄 tsconfig.json               TypeScript configuration (ES2022, strict)
│   ├── 📄 jest.config.ts              Jest configuration (80% coverage threshold)
│   │
│   ├── 📂 prisma/
│   │   ├── 📄 schema.prisma           Database schema (9 models, indexes, relations)
│   │   └── 📄 seed.ts                 Dev seed script (admin user + 7 products)
│   │
│   ├── 📂 src/
│   │   ├── 📄 server.ts               Entry point: boots DB, starts HTTP, graceful shutdown
│   │   ├── 📄 app.ts                  Express app factory (middleware, routes, SPA catch-all)
│   │   │
│   │   ├── 📂 core/
│   │   │   ├── 📂 config/
│   │   │   │   └── 📄 env.ts          Zod-validated environment variables (fails fast)
│   │   │   ├── 📂 database/
│   │   │   │   └── 📄 client.ts       Prisma client singleton with disconnect helper
│   │   │   ├── 📂 errors/
│   │   │   │   ├── 📄 app.error.ts    Abstract base error with statusCode and code
│   │   │   │   ├── 📄 http.errors.ts  NotFound, Unauthorized, Forbidden, Conflict, Validation, RateLimit
│   │   │   │   └── 📄 domain.errors.ts EmailAlreadyTaken, InvalidCredentials, TokenExpired, InsufficientStock
│   │   │   ├── 📂 middleware/
│   │   │   │   ├── 📄 authenticate.ts Bearer token verification (attaches user to request)
│   │   │   │   ├── 📄 authorize.ts    Admin-only route guard
│   │   │   │   ├── 📄 error.handler.ts Global error middleware (ZodError, AppError, 500 fallback)
│   │   │   │   ├── 📄 rate.limit.ts   Global (100/15min) and auth (10/15min) rate limiters
│   │   │   │   ├── 📄 request.id.ts   UUID v4 request ID (respects client X-Request-ID header)
│   │   │   │   ├── 📄 security.headers.ts HSTS, X-Frame-Options, CSP, Referrer-Policy, Permissions-Policy
│   │   │   │   └── 📄 validate.ts     Zod schema validation for body, query, and params
│   │   │   ├── 📂 cache/
│   │   │   │   ├── 📄 redis.client.ts  ioredis singleton (lazyConnect, no-op if REDIS_URL unset)
│   │   │   │   └── 📄 cache.service.ts CacheService with get/set/delete/deleteByPattern
│   │   │   ├── 📂 queue/
│   │   │   │   ├── 📄 queue.client.ts  BullMQ email queue (3 retries, exponential backoff)
│   │   │   │   ├── 📄 email.producer.ts Enqueue or synchronous fallback for order emails
│   │   │   │   └── 📄 email.worker.ts  BullMQ worker (concurrency 5)
│   │   │   ├── 📂 observability/
│   │   │   │   └── 📄 logger.ts       Pino structured logger with field redaction
│   │   │   ├── 📂 router/
│   │   │   │   └── 📄 index.ts        Central router mounting all 6 feature routers
│   │   │   ├── 📂 security/
│   │   │   │   ├── 📄 token.service.ts JWT sign/verify for access and refresh tokens (RS256)
│   │   │   │   └── 📄 hash.service.ts  Argon2id password hashing (64 MB memory, 3 iterations)
│   │   │   └── 📂 types/
│   │   │       ├── 📄 pagination.ts   Pagination params, meta builder, skip calculator
│   │   │       └── 📄 request.context.ts AuthenticatedRequest and RequestWithId interfaces
│   │   │
│   │   └── 📂 features/
│   │       ├── 📂 auth/               🔑 Registration, login, token refresh, logout, password reset
│   │       │   ├── 📄 auth.router.ts
│   │       │   ├── 📄 auth.controller.ts
│   │       │   ├── 📄 auth.service.ts
│   │       │   ├── 📄 auth.repository.ts
│   │       │   ├── 📄 auth.schema.ts
│   │       │   ├── 📄 auth.types.ts
│   │       │   └── 📄 auth.emails.ts  Welcome and password reset email templates
│   │       ├── 📂 users/              👤 Profile management, password change
│   │       │   ├── 📄 users.router.ts
│   │       │   ├── 📄 users.controller.ts
│   │       │   ├── 📄 users.service.ts
│   │       │   ├── 📄 users.repository.ts
│   │       │   ├── 📄 users.schema.ts
│   │       │   └── 📄 users.types.ts
│   │       ├── 📂 products/           🛍️ Product CRUD, featured listing, search, filtering
│   │       │   ├── 📄 products.router.ts
│   │       │   ├── 📄 products.controller.ts
│   │       │   ├── 📄 products.service.ts
│   │       │   ├── 📄 products.repository.ts
│   │       │   ├── 📄 products.schema.ts
│   │       │   └── 📄 products.types.ts
│   │       ├── 📂 cart/               🛒 Add, update, remove, clear cart items
│   │       │   ├── 📄 cart.router.ts
│   │       │   ├── 📄 cart.controller.ts
│   │       │   ├── 📄 cart.service.ts
│   │       │   ├── 📄 cart.repository.ts
│   │       │   ├── 📄 cart.schema.ts
│   │       │   └── 📄 cart.types.ts
│   │       ├── 📂 orders/             📦 Order creation, history, admin management
│   │       │   ├── 📄 orders.router.ts
│   │       │   ├── 📄 orders.controller.ts
│   │       │   ├── 📄 orders.service.ts
│   │       │   ├── 📄 orders.repository.ts
│   │       │   ├── 📄 orders.schema.ts
│   │       │   └── 📄 orders.types.ts
│   │       ├── 📂 payments/           💳 Stripe PaymentIntent creation, webhook handling
│   │       │   ├── 📄 payments.router.ts
│   │       │   ├── 📄 payments.controller.ts
│   │       │   ├── 📄 payments.service.ts
│   │       │   ├── 📄 payments.schema.ts
│   │       │   └── 📄 payments.types.ts
│   │       ├── 📂 wishlist/           💝 Wishlist toggle, list, remove
│   │       ├── 📂 reviews/            ⭐ Product reviews with ratings (1-5)
│   │       ├── 📂 coupons/            🎟️ Coupon validation, application, admin CRUD
│   │       ├── 📂 loyalty/            🏆 Loyalty points, tiers, redemption
│   │       ├── 📂 currency/           💱 Multi-currency exchange rates
│   │       ├── 📂 newsletter/         📧 Email subscription management
│   │       └── 📂 analytics/          📊 Admin dashboard analytics
│   │
│   └── 📂 tests/
│       ├── 📂 fixtures/
│       │   ├── 📄 user.fixture.ts     Factory functions for user test data
│       │   └── 📄 product.fixture.ts  Factory functions for product test data
│       └── 📂 unit/
│           ├── 📄 auth.service.test.ts
│           ├── 📄 cart.service.test.ts
│           ├── 📄 orders.service.test.ts
│           ├── 📄 products.service.test.ts
│           └── 📄 users.service.test.ts
│
├── 📂 client/                         React frontend (Vite SPA)
│   ├── 📄 package.json                Client dependencies and scripts
│   ├── 📄 vite.config.ts              Vite config (@ alias, API proxy to :3000)
│   ├── 📄 tailwind.config.js          Tailwind config (brand colors, fonts, animations)
│   ├── 📄 tsconfig.json               TypeScript configuration
│   ├── 📄 postcss.config.js           PostCSS with Tailwind and Autoprefixer
│   ├── 📄 index.html                  HTML entry point
│   │
│   ├── 📂 public/
│   │   ├── 📂 img/                    Product images, icons, logos (JPEG, SVG, PNG)
│   │   └── 📂 video/                  Brand video (blessp_video.mp4)
│   │
│   └── 📂 src/
│       ├── 📄 main.tsx                React DOM entry point
│       ├── 📄 App.tsx                 Route definitions (public, protected, admin)
│       │
│       ├── 📂 components/
│       │   ├── 📂 common/             AdminRoute, ProtectedRoute, CookieBanner, ProductCard
│       │   ├── 📂 layout/             Layout, Header, Footer, CartDrawer
│       │   └── 📂 ui/                 Badge, Button, Input, Modal, Skeleton, Spinner
│       │
│       ├── 📂 context/
│       │   ├── 📄 AuthContext.tsx      Authentication state, login, register, logout, auto-refresh
│       │   └── 📄 CartContext.tsx      Cart state, add/update/remove/clear operations
│       │
│       ├── 📂 hooks/
│       │   ├── 📄 useApi.ts           Custom fetch hook
│       │   └── 📄 useScrollLock.ts    Body scroll locking (for modals/drawers)
│       │
│       ├── 📂 lib/
│       │   ├── 📄 api.ts             Fetch wrapper with auto token refresh on 401
│       │   ├── 📄 types.ts           Shared TypeScript interfaces
│       │   └── 📄 utils.ts           Utility functions
│       │
│       ├── 📂 pages/
│       │   ├── 📂 admin/             Dashboard, Products, ProductEdit, Orders
│       │   ├── 📂 auth/              SignIn, SignUp, ForgotPassword, ResetPassword
│       │   ├── 📂 checkout/          CheckoutPage (Stripe Elements)
│       │   ├── 📂 home/              HomePage (hero, featured products)
│       │   ├── 📂 product/           ProductPage (gallery, size/color picker)
│       │   ├── 📂 profile/           Profile, Addresses, Orders, OrderDetail
│       │   └── 📂 shop/              ShopPage (filtered product grid)
│       │
│       └── 📂 styles/
│           └── 📄 globals.css         Tailwind base, components, utilities, scrollbar styling
│
├── 📂 docs/                           📚 Project documentation
│   ├── 📄 api.md                      Full API reference (all 61 endpoints)
│   ├── 📄 openapi.yaml                OpenAPI 3.1 specification (single source of truth)
│   ├── 📄 database.md                 Database schema documentation
│   ├── 📄 deployment.md              Deployment guide
│   ├── 📂 adr/                        Architecture Decision Records
│   │   ├── 📄 001-use-postgresql.md
│   │   ├── 📄 002-jwt-refresh-rotation.md
│   │   ├── 📄 003-monorepo-structure.md
│   │   ├── 📄 004-react-vite-tailwind.md
│   │   └── 📄 005-redis-caching-email-queue.md
│   └── 📂 runbooks/                   Operational runbooks
│       ├── 📄 001-deployment.md
│       ├── 📄 002-database-backup-restore.md
│       ├── 📄 003-incident-response.md
│       ├── 📄 004-redis-operations.md
│       └── 📄 005-secret-rotation.md
│
├── 📂 .github/
│   ├── 📂 workflows/
│   │   ├── 📄 ci.yml                 CI pipeline (lint, typecheck, test, build, Docker)
│   │   ├── 📄 release.yml            Release pipeline (CI + Docker image + GitHub release)
│   │   └── 📄 security.yml           Weekly security audit (npm audit, Prisma validate)
│   ├── 📂 ISSUE_TEMPLATE/
│   │   ├── 📄 bug_report.md
│   │   └── 📄 feature_request.md
│   └── 📄 PULL_REQUEST_TEMPLATE.md
│
└── 📂 img/                            Static assets (duplicated in client/public)
```

---

## 📡 API Endpoints

Base path: `/api/v1`

### 🔑 Authentication

| Method | Path | Description | Auth | Rate Limit |
|---|---|---|---|---|
| `POST` | `/auth/register` | Register a new user account | ❌ | 10/15min |
| `POST` | `/auth/login` | Authenticate and receive token pair | ❌ | 10/15min |
| `POST` | `/auth/refresh` | Rotate refresh token for new token pair | ❌ | 10/15min |
| `POST` | `/auth/logout` | Invalidate refresh token family | ❌ | 10/15min |
| `POST` | `/auth/forgot-password` | Request a password reset link | ❌ | 10/15min |
| `POST` | `/auth/reset-password` | Reset password with token | ❌ | 10/15min |
| `GET` | `/auth/me` | Get current authenticated user | ✅ Bearer | 100/15min |

### 👤 Users

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/users/profile` | Get authenticated user's profile | ✅ Bearer |
| `PATCH` | `/users/profile` | Update profile (firstName, lastName, email) | ✅ Bearer |
| `POST` | `/users/change-password` | Change password (requires current password) | ✅ Bearer |

### 🛍️ Products

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/products` | List products (paginated, filterable, sortable) | ❌ |
| `GET` | `/products/featured` | List featured homepage products | ❌ |
| `GET` | `/products/:id` | Get a single product by ID | ❌ |
| `POST` | `/products` | Create a new product | 🔒 Admin |
| `PATCH` | `/products/:id` | Update an existing product | 🔒 Admin |
| `DELETE` | `/products/:id` | Soft-delete a product | 🔒 Admin |

### 🛒 Cart

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/cart` | Get all items in the user's cart | ✅ Bearer |
| `POST` | `/cart` | Add item to cart (upserts on same variant) | ✅ Bearer |
| `PATCH` | `/cart/:itemId` | Update cart item quantity | ✅ Bearer |
| `DELETE` | `/cart/:itemId` | Remove a single cart item | ✅ Bearer |
| `DELETE` | `/cart` | Clear the entire cart | ✅ Bearer |

### 📦 Orders

| Method | Path | Description | Auth |
|---|---|---|---|
| `POST` | `/orders` | Create order from cart (with shipping address) | ✅ Bearer |
| `GET` | `/orders/mine` | List current user's orders (paginated) | ✅ Bearer |
| `GET` | `/orders` | List all orders (paginated) | 🔒 Admin |
| `GET` | `/orders/:id` | Get a single order (ownership enforced) | ✅ Bearer |
| `PATCH` | `/orders/:id/status` | Update order status | 🔒 Admin |

### 💳 Payments

| Method | Path | Description | Auth |
|---|---|---|---|
| `POST` | `/payments/create-intent` | Create Stripe PaymentIntent for an order | ✅ Bearer |
| `POST` | `/payments/webhook` | Handle Stripe webhook events (succeeded, failed, refunded) | 🔏 Stripe signature |

### 💝 Wishlist

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/wishlist` | Get user's wishlist | ✅ Bearer |
| `POST` | `/wishlist` | Toggle product in wishlist | ✅ Bearer |
| `DELETE` | `/wishlist/:productId` | Remove from wishlist | ✅ Bearer |

### ⭐ Reviews

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/reviews` | List product reviews (paginated) | ❌ |
| `GET` | `/reviews/summary/:productId` | Review summary (avg rating, distribution) | ❌ |
| `POST` | `/reviews` | Create a review (one per user per product) | ✅ Bearer |
| `PATCH` | `/reviews/:id` | Update own review | ✅ Bearer |
| `DELETE` | `/reviews/:id` | Delete own review | ✅ Bearer |
| `GET` | `/reviews/admin/all` | List all reviews | 🔒 Admin |
| `DELETE` | `/reviews/admin/:id` | Delete any review (moderation) | 🔒 Admin |

### 🎟️ Coupons

| Method | Path | Description | Auth |
|---|---|---|---|
| `POST` | `/coupons/validate` | Validate a coupon code | ✅ Bearer |
| `POST` | `/coupons/apply` | Apply coupon and calculate discount | ✅ Bearer |
| `POST` | `/coupons` | Create a coupon | 🔒 Admin |
| `GET` | `/coupons` | List all coupons | 🔒 Admin |
| `PATCH` | `/coupons/:id` | Update a coupon | 🔒 Admin |

### 💱 Currency

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/currencies/rates` | Get exchange rates (CAD base) | ❌ |

### 📧 Newsletter

| Method | Path | Description | Auth |
|---|---|---|---|
| `POST` | `/newsletter/subscribe` | Subscribe to newsletter | ❌ |
| `POST` | `/newsletter/unsubscribe` | Unsubscribe from newsletter | ❌ |

### 🏆 Loyalty

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/loyalty/balance` | Get points balance, tier, redemption value | ✅ Bearer |
| `GET` | `/loyalty/transactions` | List point transactions (paginated) | ✅ Bearer |
| `POST` | `/loyalty/redeem` | Redeem points for store credit | ✅ Bearer |

### 📊 Analytics (Admin)

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/analytics/overview` | Business overview metrics | 🔒 Admin |
| `GET` | `/analytics/revenue` | Revenue by day (7d, 30d, 90d) | 🔒 Admin |
| `GET` | `/analytics/top-products` | Top-selling products | 🔒 Admin |
| `GET` | `/analytics/recent-orders` | Most recent orders | 🔒 Admin |

### ❤️ Health Checks

| Method | Path | Description |
|---|---|---|
| `GET` | `/health/live` | Liveness probe (returns 200 if process is running) |
| `GET` | `/health/ready` | Readiness probe (verifies database connectivity) |

> 📖 For the full API reference with request/response schemas and examples, see [docs/api.md](docs/api.md).

---

## 🧪 Testing

### Running tests

```bash
# Run unit tests
npm run test

# Run unit tests with coverage report
cd server && npx jest --testPathPattern=tests/unit --coverage

# Run integration tests (requires running PostgreSQL)
npm run test:integration

# Run all tests
cd server && npm run test:all
```

### What is tested 🔍

| Test Suite | File | What It Covers |
|---|---|---|
| `auth.service.test.ts` | Auth service | Registration, login, token rotation, reuse detection, logout |
| `users.service.test.ts` | Users service | Profile retrieval, profile updates, password change |
| `products.service.test.ts` | Products service | CRUD operations, featured listing, soft delete |
| `cart.service.test.ts` | Cart service | Add/update/remove items, ownership checks, cart clearing |
| `orders.service.test.ts` | Orders service | Order creation from cart, ownership checks, status updates |
| `payments.service.test.ts` | Payments service | Payment intent creation, webhook handling, idempotency, refunds |
| `wishlist.service.test.ts` | Wishlist service | Toggle, add/remove, product validation |
| `currency.service.test.ts` | Currency service | Exchange rates, currency conversion, rounding |
| `analytics.service.test.ts` | Analytics service | Overview, revenue, top products, limit clamping |
| `reviews.service.test.ts` | Reviews service | CRUD, rating validation, one review per user |
| `coupons.service.test.ts` | Coupons service | Validation, application, discount calculation |
| `loyalty.service.test.ts` | Loyalty service | Balance, tiers, point redemption, order rewards |
| `newsletter.service.test.ts` | Newsletter service | Subscribe, unsubscribe, reactivation |
| `cache.service.test.ts` | Cache service | Get/set/delete, no-op mode, error resilience |
| `email.producer.test.ts` | Email producer | Queue enqueue, synchronous fallback, idempotency key |

### Test architecture 🏗️

- **Unit tests** mock all external dependencies (Prisma, hash service, token service) using Jest mocks
- **Fixtures** provide factory functions (`makeUserFixture`, `makeProductFixture`, `makeAdminFixture`) for repeatable test data
- **Coverage threshold** is enforced at 80% for branches, functions, lines, and statements
- **Path aliases** (`@core/*`, `@features/*`) work in tests via Jest `moduleNameMapper`

### CI pipeline ✅

The GitHub Actions CI pipeline runs on every pull request and push to `develop`/`main`:

1. **Lint & Type Check** (TypeScript `--noEmit` for both server and client)
2. **Unit Tests** with coverage (uploaded as artifact)
3. **Integration Tests** against an ephemeral PostgreSQL service container
4. **Build Artifacts** (both server and client)
5. **Docker Build Verification** (on pushes to `main`/`develop`)

---

## 🔒 Security Features

### 🔐 Authentication

- **Short-lived access tokens** (15-minute TTL by default) signed with RS256 (asymmetric keys)
- **Refresh token rotation** with family-based reuse detection
- If a previously consumed refresh token is reused, the entire token family is revoked, forcing re-authentication
- **Password hashing** with Argon2id (64 MB memory cost, 3 time iterations, 4 parallelism)
- **No user enumeration:** login failures return the same generic `INVALID_CREDENTIALS` error for both wrong email and wrong password

### 🛡️ HTTP Security

- **Helmet** for baseline header hardening
- **Custom security headers:** HSTS (2 years, includeSubDomains, preload), X-Frame-Options (DENY), CSP (default-src 'none'), Referrer-Policy, Permissions-Policy
- **CORS** with explicit origin allowlist (never `*` in production)
- **Rate limiting:** 100 requests per 15 minutes globally, 10 requests per 15 minutes on auth endpoints
- **Request body size limit:** 1 MB maximum (`express.json({ limit: '1mb' })`)
- **Request ID tracking:** UUID v4 attached to every request and response

### 🗄️ Data Security

- **Input validation** on all endpoints via Zod schemas (body, query, params)
- **Parameterised queries** through Prisma (no SQL injection risk)
- **Sensitive field redaction** in logs (passwords, tokens, secrets, authorization headers)
- **Stripe webhook signature verification** before processing any payment event
- **Non-root container user** in production Docker images

### 🔍 Dependency Auditing

- Weekly automated security audit via GitHub Actions (`npm audit --audit-level=high`)
- Prisma schema validation in the audit pipeline

---

## 📊 Architecture Overview

```mermaid
graph TB
    subgraph CLIENT["🌐 Client · React SPA"]
        direction LR
        C1["Vite + Tailwind CSS"]
        C2["Framer Motion"]
        C3["Stripe Elements"]
        C4["React Router"]
    end

    subgraph SERVER["⚙️ Express API Server · Port 3000"]
        direction TB

        subgraph MW["🔧 Middleware Pipeline"]
            direction LR
            MW1["helmet"] --> MW2["cors"]
            MW2 --> MW3["cookieParser"]
            MW3 --> MW4["json"]
            MW4 --> MW5["requestId"]
            MW5 --> MW6["securityHeaders"]
            MW6 --> MW7["rateLimiter"]
        end

        subgraph FEAT["🗂️ Feature Modules"]
            direction LR
            F1["🔑 Auth"]
            F2["👤 Users"]
            F3["🛍️ Products"]
            F4["🛒 Cart"]
            F5["📦 Orders"]
            F6["💳 Payments"]
        end

        subgraph LAYER["📐 Clean Layered Architecture"]
            direction LR
            L1["Router"] --> L2["Controller"]
            L2 --> L3["Service"]
            L3 --> L4["Repository"]
        end

        subgraph CORE["🛠️ Core Infrastructure"]
            direction LR
            CORE1["Config · Zod"]
            CORE2["Errors"]
            CORE3["Security"]
            CORE4["Observability · Pino"]
            CORE5["Cache · CacheService"]
            CORE6["Queue · BullMQ"]
        end
    end

    subgraph DB["🐘 PostgreSQL 16"]
        DB1["9 tables · JSONB · arrays · UUID PKs · soft deletes"]
    end

    subgraph REDIS["🗄️ Redis 7 · optional"]
        R1["Product Cache"]
        R2["BullMQ Email Queue"]
    end

    CLIENT -- "HTTP / JSON" --> SERVER
    SERVER -- "Prisma ORM" --> DB
    SERVER -. "ioredis (optional)" .-> REDIS

    style CLIENT fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#e2e8f0
    style SERVER fill:#1e293b,stroke:#a78bfa,stroke-width:2px,color:#e2e8f0
    style MW fill:#0f172a,stroke:#94a3b8,stroke-width:1px,color:#cbd5e1
    style FEAT fill:#0f172a,stroke:#94a3b8,stroke-width:1px,color:#cbd5e1
    style LAYER fill:#0f172a,stroke:#94a3b8,stroke-width:1px,color:#cbd5e1
    style CORE fill:#0f172a,stroke:#94a3b8,stroke-width:1px,color:#cbd5e1
    style DB fill:#1e293b,stroke:#34d399,stroke-width:2px,color:#e2e8f0
    style REDIS fill:#1e293b,stroke:#fb923c,stroke-width:2px,color:#e2e8f0
```

### Clean layered architecture 🧅

Each feature module follows a strict four-layer pattern:

1. **Router** registers HTTP routes and wires middleware (auth, rate limiting, validation)
2. **Controller** handles HTTP concerns only (parsing requests, shaping responses). No business logic.
3. **Service** contains all business logic and orchestration. Never touches HTTP types.
4. **Repository** encapsulates all database queries. Returns domain types, not ORM models.

Dependencies point inward: controllers call services, services call repositories. The reverse never happens.

---

## 🎨 Frontend Stack and Design System

### Design tokens 🎯

The Tailwind configuration defines a custom design system:

**Brand color palette** (warm, luxury tones):
- `brand-50` through `brand-950` (warm brown/tan spectrum)
- `neutral-50` through `neutral-950` (cool gray/black spectrum)

**Typography:**
- `font-sans`: Inter, system-ui, sans-serif (body text)
- `font-display`: Playfair Display, Georgia, serif (headings, hero text)
- `text-hero`: responsive clamp from 2.5rem to 5rem (hero headlines)

**Animations:**
- `animate-fade-in`: 0.6s ease-out opacity fade
- `animate-fade-up`: 0.6s ease-out slide-up with opacity
- `animate-slide-in-right`: 0.4s cart drawer entrance
- `animate-slide-in-left`: 0.4s panel entrance
- Custom `out-expo` easing curve for smooth transitions

### Component library 🧩

| Component | Description |
|---|---|
| `Button` | Styled button with variants and loading state |
| `Input` | Form input with label and error display |
| `Modal` | Overlay dialog with backdrop |
| `Badge` | Small status indicator |
| `Skeleton` | Loading placeholder with shimmer animation |
| `Spinner` | Animated loading indicator |
| `ProductCard` | Product thumbnail with image, name, and price |
| `CartDrawer` | Slide-in cart panel (right side) |
| `CookieBanner` | GDPR-style cookie consent banner |

### Route structure 🗺️

| Route | Access | Page |
|---|---|---|
| `/` | Public | Home (hero + featured products) |
| `/shop` | Public | Shop (product grid with filters) |
| `/products/:id` | Public | Product detail (gallery, size/color, add to cart) |
| `/signin` | Public | Sign in form |
| `/signup` | Public | Registration form |
| `/forgot-password` | Public | Password reset request |
| `/reset-password` | Public | Password reset form (with token) |
| `/checkout` | 🔒 Auth | Checkout with Stripe payment |
| `/profile` | 🔒 Auth | User profile management |
| `/profile/orders` | 🔒 Auth | Order history |
| `/profile/orders/:id` | 🔒 Auth | Order detail |
| `/profile/addresses` | 🔒 Auth | Address management |
| `/admin` | 🔒 Admin | Admin dashboard |
| `/admin/products` | 🔒 Admin | Product management |
| `/admin/products/:id/edit` | 🔒 Admin | Product editor |
| `/admin/orders` | 🔒 Admin | Order management |

### API client 🔌

The `lib/api.ts` module provides a typed fetch wrapper with:
- Automatic `Authorization: Bearer` header injection
- Transparent 401 retry with token refresh (coordinated via a singleton promise to prevent concurrent refresh calls)
- Scheduled proactive token refresh every 13 minutes (for the 15-minute TTL)
- Consistent error extraction from the API response envelope

---

## 📝 Git Conventions

### Branch naming 🌿

```
feature/TICKET-123-add-webhook-endpoint
fix/TICKET-456-prevent-double-charge
chore/upgrade-node-22
refactor/TICKET-789-extract-payment-service
docs/add-adr-for-outbox-pattern
```

### Commit message format 📋

Follow [Conventional Commits](https://conventionalcommits.org):

```
<type>(<scope>): <short summary in imperative present tense>

[optional body explaining the "why"]

[optional footer: Refs #issue]
```

**Types:** `feat`, `fix`, `refactor`, `perf`, `test`, `chore`, `docs`, `style`, `ci`, `revert`

**Examples:**

```
feat(auth): implement refresh token rotation with reuse detection
fix(orders): prevent 500 when a concurrent update races on the same order
perf(search): replace N+1 product queries with a single JOIN
```

### Pull request requirements ✅

- One logical change per PR
- All CI checks must pass before review
- At least one peer approval required
- Squash-merge to keep `main` history clean

---

## 🚢 Deployment

For the complete deployment guide, see [docs/deployment.md](docs/deployment.md).

### Quick deployment overview:

1. **Build the Docker image:** `docker compose up --build -d`
2. **Run migrations:** `docker compose exec app npx prisma migrate deploy`
3. **Seed (first deploy only):** `docker compose exec app npx tsx prisma/seed.ts`
4. **Verify health:** `curl http://localhost:3000/health/ready`

### Available scripts 📋

| Script | Description |
|---|---|
| `npm run dev` | 🔧 Start both server and client in development mode |
| `npm run dev:server` | 🖥️ Start the API server with hot reload |
| `npm run dev:client` | 🌐 Start the Vite dev server |
| `npm run build` | 📦 Build server and client for production |
| `npm run test` | 🧪 Run unit tests |
| `npm run test:integration` | 🧪 Run integration tests |
| `npm run lint` | 🔍 Lint server and client code |
| `npm run db:migrate` | 🗄️ Apply pending Prisma migrations |
| `npm run db:seed` | 🌱 Seed the database with sample data |
| `npm run db:studio` | 🔭 Open Prisma Studio for visual database browsing |

---

## 📚 Documentation

| Document | Description |
|---|---|
| [📡 API Reference](docs/api.md) | Full endpoint reference with schemas and examples |
| [🗄️ Database Schema](docs/database.md) | Every table, column, constraint, index, and relationship |
| [🚢 Deployment Guide](docs/deployment.md) | Docker deployment, env vars, migrations, security checklist |
| [📐 ADR 001: PostgreSQL](docs/adr/001-use-postgresql.md) | Why we chose PostgreSQL as the primary database |
| [🔑 ADR 002: JWT Refresh Rotation](docs/adr/002-jwt-refresh-rotation.md) | Authentication strategy and token lifecycle |
| [📦 ADR 003: Monorepo Structure](docs/adr/003-monorepo-structure.md) | Single repo for server and client |
| [🎨 ADR 004: React + Vite + Tailwind](docs/adr/004-react-vite-tailwind.md) | Frontend technology choices |
| [🗄️ ADR 005: Redis for Caching and Email Queue](docs/adr/005-redis-caching-email-queue.md) | Optional Redis for product caching and BullMQ email delivery |
| [📋 OpenAPI Specification](docs/openapi.yaml) | Complete OpenAPI 3.1 spec (61 operations, single source of truth) |
| [🚀 Runbook: Deployment](docs/runbooks/001-deployment.md) | Production deployment procedure with rollback |
| [🗄️ Runbook: Database Backup](docs/runbooks/002-database-backup-restore.md) | Backup, restore, and point-in-time recovery |
| [🚨 Runbook: Incident Response](docs/runbooks/003-incident-response.md) | Severity classification, investigation, post-mortem |
| [🔴 Runbook: Redis Operations](docs/runbooks/004-redis-operations.md) | Cache flush, queue monitoring, troubleshooting |
| [🔑 Runbook: Secret Rotation](docs/runbooks/005-secret-rotation.md) | JWT keys, DB passwords, Stripe keys rotation |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
