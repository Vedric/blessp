# API Reference

Base URL: `/api.php` (legacy router) or `/api/<module>.php` (modular routers)

All responses use `Content-Type: application/json; charset=utf-8`.

## Authentication

The API uses session-based authentication. On login, a `session_token` cookie is set with `HttpOnly`, `SameSite=Strict`, and a 48-hour lifetime. Authenticated endpoints require this cookie.

### CSRF Protection

All POST endpoints (except `/register` and `/login`) require a valid CSRF token sent via the `X-CSRF-Token` header or a `_csrf_token` POST field. Fetch a token before making POST requests:

```
GET /csrf_token → { "csrf_token": "abc123..." }
```

### Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /register` | 5 attempts per IP | 15 minutes |
| `POST /login` | 10 attempts per IP | 15 minutes |
| Login (per account) | 5 failed attempts trigger lockout | 15 minutes |

When rate-limited, the API returns `429` with a `Retry-After` header.

## Error Format

All error responses follow a consistent format:

```json
{
  "error": "error_code",
  "message": "Human-readable description."
}
```

Common error codes: `invalid_input`, `unauthorized`, `forbidden`, `not_found`, `csrf_error`, `rate_limit_exceeded`, `server_error`.

## Pagination

List endpoints support offset-based pagination:

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `page` | 1 | — | Page number (1-indexed) |
| `perPage` | 20 | 100 | Items per page |

Paginated responses include a `pagination` object:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "totalItems": 143,
    "totalPages": 8
  }
}
```

---

## Authentication Endpoints

### POST /register

Create a new user account.

**Rate limit:** 5 per 15 minutes per IP.

**Request body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `email` | string | yes | Valid email, max 254 chars |
| `password` | string | yes | 8 to 128 chars |
| `firstname` | string | yes | Max 100 chars |
| `lastname` | string | yes | Max 100 chars |

**Responses:**

| Status | Body |
|--------|------|
| 201 | `{ "ok": true, "user_id": 42 }` |
| 400 | `{ "error": "invalid_input", "message": "..." }` |
| 409 | `{ "error": "email_taken", "message": "..." }` |
| 429 | `{ "error": "rate_limit_exceeded", "message": "..." }` |

### POST /login

Authenticate and create a session. Sets the `session_token` cookie on success.

**Rate limit:** 10 per 15 minutes per IP, account lockout after 5 failures.

**Request body:**

| Field | Type | Required |
|-------|------|----------|
| `email` | string | yes |
| `password` | string | yes |

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ "ok": true }` |
| 401 | `{ "error": "invalid_credentials", "message": "Invalid email or password." }` |
| 403 | `{ "error": "account_locked", "message": "..." }` |
| 429 | `{ "error": "rate_limit_exceeded", "message": "..." }` |

### GET /logout

Destroy the current session and clear the cookie.

**Auth required:** Yes

**Response:** `{ "ok": true }`

### GET /me

Get the currently authenticated user, or `null` if not logged in.

**Auth required:** No (returns null when unauthenticated)

**Response:**

```json
{ "user": { "id": 1, "email": "alice@example.com" } }
// or
{ "user": null }
```

### GET /csrf_token

Fetch a CSRF token for subsequent POST requests.

**Response:** `{ "csrf_token": "abc123..." }`

---

## User Profile Endpoints

### GET /user_infos

Get the authenticated user's profile.

**Auth required:** Yes

**Response:**

```json
{
  "user": {
    "id": 1,
    "email": "alice@example.com",
    "firstname": "Alice",
    "lastname": "Dupont"
  }
}
```

---

## Product Endpoints

### GET /products

List all products (including inactive). Paginated.

**Auth required:** No

**Query params:** `page`, `perPage`

**Response:**

```json
{
  "data": [
    {
      "id": 1,
      "name": "Classic Hoodie",
      "price": 5900,
      "picture": "hoodie.jpg",
      "category": "hoodies",
      "active": true,
      "onfront_order": 1
    }
  ],
  "pagination": { "page": 1, "perPage": 20, "totalItems": 45, "totalPages": 3 }
}
```

### GET /active_products

List only active (published) products. Paginated.

**Auth required:** No

**Query params:** `page`, `perPage`

**Response:** Same shape as `/products`, filtered to `active = true`.

### GET /on_front

List products featured on the homepage, ordered by `onfront_order`. Paginated.

**Auth required:** No

**Query params:** `page`, `perPage`

**Response:** Same paginated shape, filtered to active products with `onfront_order > 0`.

### GET /product

Get detailed information for a single product.

**Auth required:** No

**Query params:** `id` (required)

**Response:**

```json
[
  {
    "id": 1,
    "name": "Classic Hoodie",
    "price": 5900,
    "picture": "hoodie.jpg",
    "category": "hoodies",
    "details": "Premium cotton blend...",
    "active": true,
    "secondary_pictures": "side.jpg,back.jpg",
    "colors": "black,white,navy",
    "onfront_order": 1
  }
]
```

### GET /product_min

Get minimal product data (id, name, price only).

**Auth required:** No

**Query params:** `id` (required)

---

## Cart Endpoints

Cart is session-based (PHP sessions, not tied to user accounts).

### POST /cart_add

Add an item to the cart.

**Request body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `id` | int | yes | Product ID |
| `qty` | int | yes | Quantity |
| `size` | string | yes | Max 10 chars |
| `clr` | string | yes | Max 10 chars |

Items are stored by product key: `{productId:05d}{size:03s}{color:03s}`.

### GET /cart

Retrieve current cart contents.

**Response:** `[{ "product": "00001XXL001", "quantity": 2 }, ...]`

### GET /empty_cart

Clear the entire cart.

### GET /cart_qty_up

Increase quantity of a cart item.

**Query params:** `pkey` (product key, required)

### GET /cart_qty_dwn

Decrease quantity of a cart item.

**Query params:** `pkey` (product key, required)

---

## Address Endpoints

Router: `/api/address.php`

### GET /user_addresses

List all addresses for the authenticated user. Paginated.

**Auth required:** Yes

**Query params:** `page`, `perPage`

### GET /address/address

Get a specific address by ID.

**Auth required:** Yes

**Query params:** `address_id` (required)

### GET /user_default_address

Get the user's default address.

**Auth required:** Yes

### POST /address/add

Create a new address.

**Auth required:** Yes | **CSRF required:** Yes

**Request body:**

| Field | Type | Required |
|-------|------|----------|
| `firstname` | string | yes |
| `lastname` | string | yes |
| `address` | string | yes |
| `city` | string | yes |
| `postalcode` | string | yes |
| `phonenumber` | string | no |
| `country` | string | yes |
| `default` | boolean | no |

### POST /address/save

Update an existing address.

**Auth required:** Yes | **CSRF required:** Yes

**Request body:** Same as `/address/add`, plus `id` (int, required).

### GET /address/delete

Delete an address.

**Auth required:** Yes

**Query params:** `addressId` (required)

---

## Order Endpoints

Router: `/api/orders.php`

### GET /orders

List all paid orders (admin only). Paginated.

**Auth required:** Yes (admin)

**Query params:** `page`, `perPage`

### GET /user_orders

List all orders for the authenticated user. Paginated.

**Auth required:** Yes

**Query params:** `page`, `perPage`

**Response:** Each order includes its items with product details and customer information.

### GET /order

Get a specific order with its items.

**Auth required:** Yes

**Query params:** `order_num` (required)

### POST /save_payed_order

Save a completed payment with shipping address and order items.

**Auth required:** Yes | **CSRF required:** Yes

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| `orderAmount` | float | Total amount paid |
| `transaction_key` | string | Payment transaction ID |
| `account_address` | object | Shipping address (existing `id` or full address fields) |
| `items` | array | Cart items: `[{ "product": "key", "quantity": int }]` |

**Response:** `{ "ok": true, "order_id": 123, "user": { ... } }`

### POST /checkout

Create an order from the current cart.

**Auth required:** Yes

**Response:** `{ "ok": true, "order_id": 123 }`

---

## Stripe Payment Endpoints

Router: `/api/stripe.php`

### POST /create_payment_intent

Create a Stripe PaymentIntent for the checkout amount. The secret key is never exposed to the frontend.

**Auth required:** Yes | **CSRF required:** Yes

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | float | yes | Total in dollars (e.g. 59.99) |
| `currency` | string | no | ISO currency code, default `cad`. Allowed: `cad`, `usd`, `eur` |
| `nonce` | string | yes | Client-generated unique string for idempotency (max 128 chars) |

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ "clientSecret": "pi_..._secret_...", "paymentIntentId": "pi_..." }` |
| 400 | `{ "error": "invalid_input", "message": "..." }` |
| 401 | `{ "error": "unauthenticated", "message": "..." }` |

The `clientSecret` is passed to Stripe.js on the frontend to confirm the payment.

### POST /webhook

Handle Stripe webhook events. Uses signature verification instead of session auth.

**Auth required:** No (verified via `Stripe-Signature` header)

**Handled events:**

| Event | Action |
|-------|--------|
| `payment_intent.succeeded` | Updates order status to `PAYED` |
| `payment_intent.payment_failed` | Logs the failure for monitoring |

**Response:** `{ "received": true }`

Configure the webhook URL in the Stripe Dashboard: `https://your-domain.com/api/stripe.php/webhook`
