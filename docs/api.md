# 📡 API Reference

> Complete endpoint documentation for the BLE$$ P API, version 3.0.0.

## 📋 Table of Contents

1. [Overview](#-overview)
2. [Authentication](#-authentication)
3. [Response Format](#-response-format)
4. [Rate Limiting](#-rate-limiting)
5. [Pagination](#-pagination)
6. [Auth Endpoints](#-auth-endpoints)
7. [Users Endpoints](#-users-endpoints)
8. [Products Endpoints](#-products-endpoints)
9. [Cart Endpoints](#-cart-endpoints)
10. [Orders Endpoints](#-orders-endpoints)
11. [Payments Endpoints](#-payments-endpoints)
12. [Health Check Endpoints](#-health-check-endpoints)
13. [Error Codes Reference](#-error-codes-reference)
14. [HTTP Status Codes](#-http-status-codes)

---

## 🌐 Overview

The BLE$$ P API follows REST conventions with a consistent JSON response envelope. All endpoints are served under the base path:

```
/api/v1
```

Content type for all requests and responses is `application/json` (except for the Stripe webhook endpoint, which expects `application/json` as raw bytes).

The maximum request body size is **1 MB**.

---

## 🔐 Authentication

Protected endpoints require a valid JWT access token sent as a Bearer token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

### Token lifecycle ⏱️

| Token Type | Default TTL | Storage | Secret |
| --- | --- | --- | --- |
| Access token | 15 minutes (`JWT_ACCESS_EXPIRY`) | Client memory / localStorage | RS256 (asymmetric, `JWT_PRIVATE_KEY_BASE64` / `JWT_PUBLIC_KEY_BASE64`) |
| Refresh token | 7 days (`JWT_REFRESH_EXPIRY`) | Client localStorage + database | RS256 (asymmetric, `JWT_PRIVATE_KEY_BASE64` / `JWT_PUBLIC_KEY_BASE64`) |

### Access token payload 📦

```json
{
  "userId": "uuid-string",
  "email": "user@example.com",
  "isAdmin": false,
  "iat": 1710000000,
  "exp": 1710000900
}
```

### Token refresh flow 🔄

1. Client detects a `401` response (or proactively refreshes before expiry)
2. Client sends `POST /api/v1/auth/refresh` with the refresh token
3. Server validates the refresh token, marks it as used, issues a new token pair
4. If a previously used refresh token is submitted, the entire token family is revoked (replay attack detection)

---

## 📦 Response Format

### ✅ Successful responses

```json
{
  "data": { "id": "...", "email": "..." },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-03-13T14:32:00.123Z"
  }
}
```

### 📄 Paginated responses

```json
{
  "data": [ { "id": "..." }, { "id": "..." } ],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "totalItems": 143,
    "totalPages": 8
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-03-13T14:32:00.123Z"
  }
}
```

### ❌ Error responses

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "User with id 'abc' does not exist.",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### ❌ Validation error responses (with field details)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "fields": {
      "email": ["A valid email address is required."],
      "password": ["Password must be at least 12 characters long.", "Password must contain at least one number."]
    },
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

## ⏱️ Rate Limiting

All endpoints are subject to rate limiting. Rate limit headers are returned on every response:

| Header | Description |
| --- | --- |
| `RateLimit-Limit` | Maximum requests per window |
| `RateLimit-Remaining` | Remaining requests in the current window |
| `RateLimit-Reset` | Seconds until the window resets |

### Rate limit tiers

| Scope | Window | Max Requests | Applied To |
| --- | --- | --- | --- |
| 🌐 Global | 15 minutes | 100 per IP | All endpoints |
| 🔐 Auth | 15 minutes | 10 per IP | `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password` |

When the limit is exceeded, the API returns:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please wait before trying again."
  }
}
```

**HTTP status:** `429 Too Many Requests`

---

## 📄 Pagination

List endpoints accept the following query parameters:

| Parameter | Type | Default | Maximum | Description |
| --- | --- | --- | --- | --- |
| `page` | integer | 1 | none | Page number (1-indexed) |
| `perPage` | integer | 20 | 100 | Items per page |

Requests with `perPage` above 100 are clamped to 100 by the pagination utility. Requests with `page` below 1 default to 1.

---

## 🔑 Auth Endpoints

### POST /api/v1/auth/register

Register a new user account and receive an authentication token pair.

**🔓 Auth required:** No
**⏱️ Rate limit:** 10 requests per 15 minutes per IP

#### Request body

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `email` | string | ✅ Yes | Valid email format, max 254 characters, normalised to lowercase, trimmed |
| `password` | string | ✅ Yes | 12 to 128 characters, at least one uppercase letter, at least one digit |
| `firstName` | string | ✅ Yes | 1 to 100 characters, trimmed |
| `lastName` | string | ✅ Yes | 1 to 100 characters, trimmed |

#### Success response: `201 Created`

```json
{
  "data": {
    "user": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "email": "jane@example.com",
      "firstName": "Jane",
      "lastName": "Doe",
      "isAdmin": false,
      "createdAt": "2026-03-13T14:00:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  },
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-03-13T14:00:00.123Z"
  }
}
```

#### Error responses

| Status | Code | When |
| --- | --- | --- |
| `409` | `EMAIL_ALREADY_TAKEN` | An account with this email already exists |
| `422` | `VALIDATION_ERROR` | Request body fails schema validation |
| `429` | `RATE_LIMIT_EXCEEDED` | Too many registration attempts |

---

### POST /api/v1/auth/login

Authenticate with email and password. Returns user data and a token pair.

**🔓 Auth required:** No
**⏱️ Rate limit:** 10 requests per 15 minutes per IP

#### Request body

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `email` | string | ✅ Yes | Valid email format, normalised to lowercase, trimmed |
| `password` | string | ✅ Yes | Non-empty string |

#### Success response: `200 OK`

```json
{
  "data": {
    "user": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "email": "jane@example.com",
      "firstName": "Jane",
      "lastName": "Doe",
      "isAdmin": false,
      "createdAt": "2026-03-13T14:00:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
    }
  },
  "meta": {
    "requestId": "...",
    "timestamp": "..."
  }
}
```

#### Error responses

| Status | Code | When |
| --- | --- | --- |
| `401` | `INVALID_CREDENTIALS` | Wrong email or wrong password (same error for both to prevent user enumeration) |
| `422` | `VALIDATION_ERROR` | Request body fails schema validation |
| `429` | `RATE_LIMIT_EXCEEDED` | Too many login attempts |

> 🛡️ **Security note:** The API never discloses whether a given email address exists. Both "email not found" and "wrong password" produce the identical `INVALID_CREDENTIALS` response.

---

### POST /api/v1/auth/refresh

Exchange a valid refresh token for a new access/refresh token pair. The previous refresh token is invalidated (rotation).

**🔓 Auth required:** No
**⏱️ Rate limit:** 10 requests per 15 minutes per IP

#### Request body

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `refreshToken` | string | ✅ Yes | Non-empty string (the JWT refresh token) |

#### Success response: `200 OK`

```json
{
  "data": {
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
    }
  },
  "meta": { "requestId": "...", "timestamp": "..." }
}
```

#### Error responses

| Status | Code | When |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | Token is invalid, expired, or the family has been revoked |
| `422` | `VALIDATION_ERROR` | Missing or empty `refreshToken` field |

#### Reuse detection 🛡️

If a previously consumed refresh token is submitted:

1. The entire token family is revoked (all tokens from the same login session)
2. The user is forced to re-authenticate
3. The error message: `"Refresh token reuse detected. All sessions have been invalidated."`

---

### POST /api/v1/auth/logout

Invalidate the provided refresh token and revoke its entire token family.

**🔓 Auth required:** No
**⏱️ Rate limit:** 10 requests per 15 minutes per IP

#### Request body

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `refreshToken` | string | ✅ Yes | Non-empty string |

#### Success response: `204 No Content`

No response body.

#### Behaviour notes

- If the refresh token is found, its entire family is deleted from the database
- If the token is not found, the endpoint still returns `204` (idempotent)
- The short-lived access token remains valid until its natural expiry (up to 15 minutes)

---

### POST /api/v1/auth/forgot-password

Request a password reset link. In development, the reset URL is logged to the server console. In production, this would send an email.

**🔓 Auth required:** No
**⏱️ Rate limit:** 10 requests per 15 minutes per IP

#### Request body

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `email` | string | ✅ Yes | Valid email format, normalised to lowercase, trimmed |

#### Success response: `200 OK`

```json
{
  "data": {
    "message": "If an account with that email exists, a password reset link has been sent."
  },
  "meta": { "requestId": "...", "timestamp": "..." }
}
```

> 🛡️ **Security note:** The response is always the same regardless of whether the email exists, preventing user enumeration. The reset token expires after 1 hour.

---

### POST /api/v1/auth/reset-password

Reset a user's password using a valid reset token. All existing refresh tokens for the user are revoked.

**🔓 Auth required:** No
**⏱️ Rate limit:** 10 requests per 15 minutes per IP

#### Request body

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `token` | string | ✅ Yes | The reset token from the reset URL |
| `password` | string | ✅ Yes | 12 to 128 characters, at least one uppercase letter, at least one digit |

#### Success response: `200 OK`

```json
{
  "data": { "message": "Password has been reset successfully." },
  "meta": { "requestId": "...", "timestamp": "..." }
}
```

#### Error responses

| Status | Code | When |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | Invalid, expired, or already used reset token |
| `422` | `VALIDATION_ERROR` | Password does not meet complexity requirements |

---

### GET /api/v1/auth/me

Return the currently authenticated user's information.

**🔒 Auth required:** Yes (Bearer token)

#### Success response: `200 OK`

```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "jane@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "isAdmin": false,
    "createdAt": "2026-03-13T14:00:00.000Z"
  },
  "meta": { "requestId": "...", "timestamp": "..." }
}
```

#### Error responses

| Status | Code | When |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | Missing, malformed, or expired access token |
| `401` | `TOKEN_EXPIRED` | Access token has expired (client should refresh) |

---

## 👤 Users Endpoints

All user endpoints require authentication. Users can only access and modify their own profile.

### GET /api/v1/users/profile

Get the authenticated user's profile.

**🔒 Auth required:** Yes (Bearer token)

#### Success response: `200 OK`

```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "jane@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "isAdmin": false,
    "createdAt": "2026-03-13T14:00:00.000Z",
    "updatedAt": "2026-03-13T15:30:00.000Z"
  },
  "meta": { "requestId": "...", "timestamp": "..." }
}
```

#### Error responses

| Status | Code | When |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | Not authenticated |
| `404` | `RESOURCE_NOT_FOUND` | User account has been soft-deleted |

---

### PATCH /api/v1/users/profile

Update the authenticated user's profile. All fields are optional. The schema uses strict mode, so extra fields are rejected.

**🔒 Auth required:** Yes (Bearer token)

#### Request body

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `firstName` | string | ❌ No | 1 to 100 characters, trimmed |
| `lastName` | string | ❌ No | 1 to 100 characters, trimmed |
| `email` | string | ❌ No | Valid email format, max 254 characters, normalised to lowercase, trimmed |

#### Success response: `200 OK`

Same shape as `GET /users/profile`.

#### Error responses

| Status | Code | When |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | Not authenticated |
| `404` | `RESOURCE_NOT_FOUND` | User not found |
| `409` | `CONFLICT` | New email is already taken by another account |
| `422` | `VALIDATION_ERROR` | Invalid field values or extra fields in body |

---

### POST /api/v1/users/change-password

Change the authenticated user's password. Requires the current password for verification.

**🔒 Auth required:** Yes (Bearer token)

#### Request body

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `currentPassword` | string | ✅ Yes | Non-empty string (must match current password) |
| `newPassword` | string | ✅ Yes | 12 to 128 characters, at least one uppercase letter, at least one digit |

#### Success response: `204 No Content`

No response body.

#### Error responses

| Status | Code | When |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | Not authenticated |
| `401` | `INVALID_CREDENTIALS` | Current password is incorrect |
| `422` | `VALIDATION_ERROR` | New password does not meet complexity requirements |

---

## 🛍️ Products Endpoints

Public endpoints (GET) do not require authentication. Write operations (POST, PATCH, DELETE) require admin privileges.

### GET /api/v1/products

List products with pagination, filtering, searching, and sorting. Only active, non-deleted products are returned.

**🔓 Auth required:** No

#### Query parameters

| Parameter | Type | Default | Max | Description |
| --- | --- | --- | --- | --- |
| `page` | integer | 1 | none | Page number (1-indexed) |
| `perPage` | integer | 20 | 100 | Items per page |
| `category` | string | none | 100 chars | Filter by exact category match (e.g., `hoodies`, `pants`, `sets`) |
| `search` | string | none | 200 chars | Case-insensitive search across product name and description |
| `sort` | string | `createdAt:desc` | 100 chars | Sort expression (see below) |
| `isActive` | string | none | n/a | Filter by active status: `"true"` or `"false"` |

#### Sorting 🔃

The `sort` parameter accepts comma-separated field:direction pairs.

**Allowed sort fields:** `name`, `price`, `createdAt`, `updatedAt`, `category`

**Examples:**

- `sort=price:asc` (cheapest first)
- `sort=createdAt:desc` (newest first, this is the default)
- `sort=name:asc,price:desc` (alphabetical, then by price descending)

Unrecognised field names are silently ignored. Invalid directions default to `desc`.

#### Success response: `200 OK`

```json
{
  "data": [
    {
      "id": "a1b2c3d4-...",
      "name": "Classic Black Hoodie",
      "price": 8999,
      "description": "Elevate your everyday look...",
      "details": "100% heavyweight organic cotton, 400 GSM...",
      "picture": "/img/black_hoody_1.jpeg",
      "images": ["/img/black_hoody_1.jpeg", "/img/black_hoody_2.jpeg", "/img/black_hoody_3.jpeg"],
      "category": "hoodies",
      "colors": ["Black"],
      "sizes": ["S", "M", "L", "XL"],
      "isActive": true,
      "onfrontOrder": 1,
      "createdAt": "2026-03-13T10:00:00.000Z",
      "updatedAt": "2026-03-13T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "totalItems": 7,
    "totalPages": 1
  },
  "meta": { "requestId": "...", "timestamp": "..." }
}
```

> 💰 **Note:** The `price` field is in **cents**. Divide by 100 for display (e.g., `8999` = $89.99 or 89,99 EUR).

---

### GET /api/v1/products/featured

List featured products (those with a non-null `onfrontOrder`), sorted by their display order. Only active, non-deleted products are included.

**🔓 Auth required:** No

#### Success response: `200 OK`

```json
{
  "data": [
    { "id": "...", "name": "Classic Black Hoodie", "onfrontOrder": 1, "..." : "..." },
    { "id": "...", "name": "Ocean Blue Hoodie", "onfrontOrder": 2, "..." : "..." },
    { "id": "...", "name": "Rose Pink Hoodie", "onfrontOrder": 3, "..." : "..." },
    { "id": "...", "name": "Black Hoodie & Pants Set", "onfrontOrder": 4, "..." : "..." }
  ],
  "meta": { "requestId": "...", "timestamp": "..." }
}
```

---

### GET /api/v1/products/:id

Get a single product by its UUID. Returns `404` if the product is not found or has been soft-deleted.

**🔓 Auth required:** No

#### Path parameters

| Parameter | Type | Required | Constraints |
| --- | --- | --- | --- |
| `id` | string | ✅ Yes | UUID format |

#### Success response: `200 OK`

```json
{
  "data": {
    "id": "a1b2c3d4-...",
    "name": "Classic Black Hoodie",
    "price": 8999,
    "description": "Elevate your everyday look with the Classic Black Hoodie...",
    "details": "100% heavyweight organic cotton, 400 GSM. Ribbed cuffs and hem...",
    "picture": "/img/black_hoody_1.jpeg",
    "images": ["/img/black_hoody_1.jpeg", "/img/black_hoody_2.jpeg", "/img/black_hoody_3.jpeg"],
    "category": "hoodies",
    "colors": ["Black"],
    "sizes": ["S", "M", "L", "XL"],
    "isActive": true,
    "onfrontOrder": 1,
    "createdAt": "2026-03-13T10:00:00.000Z",
    "updatedAt": "2026-03-13T10:00:00.000Z"
  },
  "meta": { "requestId": "...", "timestamp": "..." }
}
```

#### Error responses

| Status | Code | When |
| --- | --- | --- |
| `404` | `RESOURCE_NOT_FOUND` | Product does not exist or has been soft-deleted |

---

### POST /api/v1/products

Create a new product. Requires admin privileges.

**🔒 Auth required:** Admin only (Bearer token + `isAdmin: true`)

#### Request body

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `name` | string | ✅ Yes | 1 to 200 characters, trimmed |
| `price` | integer | ✅ Yes | Positive integer (price in cents) |
| `description` | string | ❌ No | Max 2000 characters, trimmed |
| `details` | string | ❌ No | Max 5000 characters, trimmed |
| `picture` | string | ❌ No | Valid URL |
| `images` | string[] | ❌ No | Array of up to 20 valid URLs |
| `category` | string | ❌ No | Max 100 characters, trimmed |
| `colors` | string[] | ❌ No | Array of up to 30 strings (max 50 chars each) |
| `sizes` | string[] | ❌ No | Array of up to 20 strings (max 20 chars each) |
| `isActive` | boolean | ❌ No | Defaults to `true` |
| `onfrontOrder` | integer | ❌ No | Non-negative integer for featured product ordering |

> ⚠️ **Strict mode:** Extra fields not listed above are rejected with a `422` error.

#### Success response: `201 Created`

Returns the full product object.

#### Error responses

| Status | Code | When |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | Not authenticated |
| `403` | `FORBIDDEN` | Authenticated but not an admin |
| `422` | `VALIDATION_ERROR` | Invalid field values or schema mismatch |

---

### PATCH /api/v1/products/:id

Partially update an existing product. All fields are optional. Nullable fields (`description`, `details`, `picture`, `category`, `onfrontOrder`) accept `null` to clear the value.

**🔒 Auth required:** Admin only

#### Request body

Same fields as `POST /products`, all optional. Strict mode applies.

#### Success response: `200 OK`

Returns the updated product object.

#### Error responses

| Status | Code | When |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | Not authenticated |
| `403` | `FORBIDDEN` | Not an admin |
| `404` | `RESOURCE_NOT_FOUND` | Product not found or soft-deleted |
| `422` | `VALIDATION_ERROR` | Invalid field values |

---

### DELETE /api/v1/products/:id

Soft-delete a product by setting its `deletedAt` timestamp and marking `isActive` as `false`. The product remains in the database but is excluded from all queries.

**🔒 Auth required:** Admin only

#### Success response: `204 No Content`

No response body.

#### Error responses

| Status | Code | When |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | Not authenticated |
| `403` | `FORBIDDEN` | Not an admin |
| `404` | `RESOURCE_NOT_FOUND` | Product not found or already deleted |

---

## 🛒 Cart Endpoints

All cart endpoints require authentication. Each user has a single cart scoped to their account. Cart items are uniquely constrained by the combination of `(userId, productId, size, color)`.

### GET /api/v1/cart

Get all items in the authenticated user's cart, including product details. Items are ordered by creation date (newest first).

**🔒 Auth required:** Yes (Bearer token)

#### Success response: `200 OK`

```json
{
  "data": {
    "items": [
      {
        "id": "cart-item-uuid",
        "productId": "product-uuid",
        "quantity": 2,
        "size": "M",
        "color": "Black",
        "product": {
          "id": "product-uuid",
          "name": "Classic Black Hoodie",
          "price": 8999,
          "picture": "/img/black_hoody_1.jpeg",
          "isActive": true
        }
      }
    ],
    "totalCents": 17998,
    "itemCount": 2
  },
  "meta": { "requestId": "...", "timestamp": "..." }
}
```

---

### POST /api/v1/cart

Add an item to the cart. If the same product with the same size and color already exists, the quantity is **incremented** (upsert behaviour).

**🔒 Auth required:** Yes (Bearer token)

#### Request body

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `productId` | string (UUID) | ✅ Yes | Must reference an existing, active product |
| `quantity` | integer | ✅ Yes | 1 to 99 |
| `size` | string | ❌ No | Max 20 characters, trimmed |
| `color` | string | ❌ No | Max 50 characters, trimmed |

> ⚠️ **Strict mode:** Extra fields are rejected.

#### Success response: `201 Created`

Returns the full cart (same shape as `GET /cart`).

#### Error responses

| Status | Code | When |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | Not authenticated |
| `404` | `RESOURCE_NOT_FOUND` | Product not found or not active |
| `422` | `VALIDATION_ERROR` | Invalid field values |

---

### PATCH /api/v1/cart/:itemId

Update the quantity of a specific cart item. Ownership is verified (users can only modify their own cart items).

**🔒 Auth required:** Yes (Bearer token)

#### Path parameters

| Parameter | Type | Required | Constraints |
| --- | --- | --- | --- |
| `itemId` | string (UUID) | ✅ Yes | Must reference an existing cart item |

#### Request body

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `quantity` | integer | ✅ Yes | 1 to 99 |

#### Success response: `200 OK`

Returns the full cart (same shape as `GET /cart`).

#### Error responses

| Status | Code | When |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | Not authenticated |
| `403` | `FORBIDDEN` | Cart item belongs to another user |
| `404` | `RESOURCE_NOT_FOUND` | Cart item not found |
| `422` | `VALIDATION_ERROR` | Invalid quantity |

---

### DELETE /api/v1/cart/:itemId

Remove a single item from the cart. Ownership is verified.

**🔒 Auth required:** Yes (Bearer token)

#### Path parameters

| Parameter | Type | Required | Constraints |
| --- | --- | --- | --- |
| `itemId` | string (UUID) | ✅ Yes | Must reference an existing cart item |

#### Success response: `204 No Content`

No response body.

#### Error responses

| Status | Code | When |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | Not authenticated |
| `403` | `FORBIDDEN` | Cart item belongs to another user |
| `404` | `RESOURCE_NOT_FOUND` | Cart item not found |

---

### DELETE /api/v1/cart

Clear all items from the authenticated user's cart.

**🔒 Auth required:** Yes (Bearer token)

#### Success response: `204 No Content`

No response body.

---

## 📦 Orders Endpoints

### POST /api/v1/orders

Create a new order from the items currently in the authenticated user's cart. The cart is cleared after successful order creation. A shipping address must be provided.

**🔒 Auth required:** Yes (Bearer token)

#### Request body

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `firstName` | string | ✅ Yes | 1 to 100 characters, trimmed |
| `lastName` | string | ✅ Yes | 1 to 100 characters, trimmed |
| `phone` | string | ❌ No | Max 30 characters, trimmed |
| `addressLine1` | string | ✅ Yes | 1 to 200 characters, trimmed |
| `addressLine2` | string | ❌ No | Max 200 characters, trimmed |
| `city` | string | ✅ Yes | 1 to 100 characters, trimmed |
| `postalCode` | string | ✅ Yes | 1 to 20 characters, trimmed |
| `province` | string | ❌ No | Max 100 characters, trimmed |
| `country` | string | ✅ Yes | 1 to 100 characters, trimmed |

> ⚠️ **Strict mode:** Extra fields are rejected.

#### What happens during order creation 🔄

1. The user's cart is retrieved and validated (must not be empty)
2. All products in the cart are verified to still be active
3. The total is computed from current product prices
4. The shipping address is stored as a JSON snapshot on the order
5. Order items are created with denormalised product name and price (preserving the values at purchase time)
6. The order is created inside a database transaction
7. The cart is cleared

#### Success response: `201 Created`

```json
{
  "data": {
    "id": "order-uuid",
    "userId": "user-uuid",
    "totalCents": 23997,
    "status": "pending",
    "transactionKey": null,
    "shippingAddress": {
      "firstName": "Jane",
      "lastName": "Doe",
      "phone": "+33612345678",
      "addressLine1": "42 Rue de la Paix",
      "city": "Paris",
      "postalCode": "75002",
      "country": "France"
    },
    "items": [
      {
        "id": "order-item-uuid",
        "productId": "product-uuid",
        "productKey": "product-uuid",
        "productName": "Classic Black Hoodie",
        "quantity": 1,
        "unitPriceCents": 8999,
        "size": "M",
        "color": "Black"
      }
    ],
    "createdAt": "2026-03-13T14:00:00.000Z",
    "updatedAt": "2026-03-13T14:00:00.000Z"
  },
  "meta": { "requestId": "...", "timestamp": "..." }
}
```

#### Error responses

| Status | Code | When |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | Not authenticated |
| `422` | `VALIDATION_ERROR` | Cart is empty, or products are no longer available, or address validation fails |

---

### GET /api/v1/orders/mine

List the authenticated user's orders with pagination and optional status filtering.

**🔒 Auth required:** Yes (Bearer token)

#### Query parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `page` | integer | 1 | Page number |
| `perPage` | integer | 20 | Items per page (max 100) |
| `status` | string | none | Filter by status: `pending`, `paid`, `shipped`, `delivered`, `cancelled` |

#### Success response: `200 OK` (paginated)

Returns an array of order objects (same shape as the `POST /orders` response) with pagination metadata.

---

### GET /api/v1/orders

List all orders across all users. **Admin only.**

**🔒 Auth required:** Admin only

#### Query parameters

Same as `GET /orders/mine`.

#### Success response: `200 OK` (paginated)

---

### GET /api/v1/orders/:id

Get a single order by ID. Non-admin users can only access their own orders. Admins can access any order.

**🔒 Auth required:** Yes (Bearer token)

#### Path parameters

| Parameter | Type | Required | Constraints |
| --- | --- | --- | --- |
| `id` | string (UUID) | ✅ Yes | Must reference an existing order |

#### Success response: `200 OK`

Returns the full order object (same shape as `POST /orders` response).

#### Error responses

| Status | Code | When |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | Not authenticated |
| `403` | `FORBIDDEN` | User does not own this order (and is not an admin) |
| `404` | `RESOURCE_NOT_FOUND` | Order not found |

---

### PATCH /api/v1/orders/:id/status

Update an order's status. **Admin only.**

**🔒 Auth required:** Admin only

#### Path parameters

| Parameter | Type | Required | Constraints |
| --- | --- | --- | --- |
| `id` | string (UUID) | ✅ Yes | Must reference an existing order |

#### Request body

| Field | Type | Required | Allowed values |
| --- | --- | --- | --- |
| `status` | string | ✅ Yes | `pending`, `paid`, `shipped`, `delivered`, `cancelled` |

> ⚠️ **Strict mode:** Extra fields are rejected.

#### Success response: `200 OK`

Returns the updated order object.

#### Error responses

| Status | Code | When |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | Not authenticated |
| `403` | `FORBIDDEN` | Not an admin |
| `404` | `RESOURCE_NOT_FOUND` | Order not found |
| `422` | `VALIDATION_ERROR` | Invalid status value |

---

## 💳 Payments Endpoints

### POST /api/v1/payments/create-intent

Create a Stripe PaymentIntent for an existing pending order. The order must belong to the authenticated user, have a `pending` status, and a total greater than zero.

**🔒 Auth required:** Yes (Bearer token)

#### Request body

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| `orderId` | string (UUID) | ✅ Yes | Must reference an existing pending order |
| `currency` | string | ❌ No | 3-letter ISO currency code, defaults to `eur` |

> ⚠️ **Strict mode:** Extra fields are rejected.

#### Success response: `201 Created`

```json
{
  "data": {
    "clientSecret": "pi_3abc123_secret_xyz",
    "paymentIntentId": "pi_3abc123",
    "amount": 23997,
    "currency": "eur"
  },
  "meta": { "requestId": "...", "timestamp": "..." }
}
```

#### What happens 🔄

1. The order is fetched and validated (exists, belongs to user, status is `pending`, total > 0)
2. A Stripe PaymentIntent is created with `metadata.orderId` and `metadata.userId`
3. The Stripe PaymentIntent ID is stored as the order's `transactionKey`
4. The `clientSecret` is returned to the frontend for use with Stripe Elements

#### Error responses

| Status | Code | When |
| --- | --- | --- |
| `401` | `UNAUTHORIZED` | Not authenticated |
| `403` | `FORBIDDEN` | Order belongs to another user |
| `404` | `RESOURCE_NOT_FOUND` | Order not found |
| `422` | `VALIDATION_ERROR` | Order is not in `pending` status, or total is zero |

---

### POST /api/v1/payments/webhook

Handle incoming Stripe webhook events. This endpoint receives raw JSON bodies and verifies the webhook signature using the `stripe-signature` header and the configured `STRIPE_WEBHOOK_SECRET`.

**🔓 Auth required:** No (authenticated via Stripe signature verification)

#### Request headers

| Header | Required | Description |
| --- | --- | --- |
| `stripe-signature` | ✅ Yes | Stripe's webhook signature |
| `Content-Type` | ✅ Yes | Must be `application/json` |

#### Request body

Raw JSON (Stripe event payload). The route uses `express.raw()` middleware to receive the body as a Buffer for signature verification.

#### Handled event types 🎯

| Stripe Event | Action |
| --- | --- |
| `payment_intent.succeeded` | Order status updated to `paid` |
| `payment_intent.payment_failed` | Order status updated to `cancelled` |
| All other events | Logged at debug level, no action taken |

#### Success response: `200 OK`

```json
{ "received": true }
```

#### Error responses

| Status | Code | When |
| --- | --- | --- |
| `400` | `MISSING_SIGNATURE` | Missing `stripe-signature` header |
| `422` | `VALIDATION_ERROR` | Signature verification failed |

---

## ❤️ Health Check Endpoints

These endpoints are **not** under the `/api/v1` prefix.

### GET /health/live

Liveness probe. Returns `200 OK` if the process is running. Use this for container liveness probes and uptime monitors.

#### Success response: `200 OK`

```json
{ "status": "alive" }
```

---

### GET /health/ready

Readiness probe. Returns `200 OK` only if the database is reachable. Use this for load balancer health checks and container readiness probes.

#### Success response: `200 OK`

```json
{
  "status": "ready",
  "checks": { "database": "fulfilled" }
}
```

#### Failure response: `503 Service Unavailable`

```json
{
  "status": "unavailable",
  "checks": { "database": "rejected" }
}
```

---

## 🚨 Error Codes Reference

| Code | HTTP Status | Description |
| --- | --- | --- |
| `VALIDATION_ERROR` | 422 | Request body/query/params failed schema validation |
| `RESOURCE_NOT_FOUND` | 404 | The requested resource does not exist or has been deleted |
| `UNAUTHORIZED` | 401 | Authentication is required or the provided token is invalid |
| `TOKEN_EXPIRED` | 401 | The access or refresh token has expired |
| `INVALID_CREDENTIALS` | 401 | Wrong email or wrong password (deliberately ambiguous) |
| `EMAIL_ALREADY_TAKEN` | 409 | An account with this email address already exists |
| `FORBIDDEN` | 403 | Authenticated but insufficient permissions for this action |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate email on profile update) |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests in the current time window |
| `INSUFFICIENT_STOCK` | 422 | Insufficient stock for the requested product |
| `INTERNAL_ERROR` | 500 | Unexpected server error (details are logged internally) |
| `MISSING_SIGNATURE` | 400 | Stripe webhook signature header is missing |

---

## 📊 HTTP Status Codes

| Code | Meaning |
| --- | --- |
| `200` | ✅ Request succeeded |
| `201` | ✅ Resource created |
| `204` | ✅ Successful operation with no response body |
| `400` | ❌ Bad request (malformed input) |
| `401` | 🔐 Authentication required or invalid credentials |
| `403` | 🚫 Authenticated but insufficient permissions |
| `404` | 🔍 Resource not found |
| `409` | ⚡ Conflict (e.g., duplicate email) |
| `422` | 📋 Validation error (schema or semantic) |
| `429` | ⏱️ Rate limit exceeded |
| `500` | 💥 Unexpected server error |
| `503` | 🔧 Service unavailable (downstream dependency failure) |
