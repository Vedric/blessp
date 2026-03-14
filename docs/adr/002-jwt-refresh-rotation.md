# 002. 🔐 JWT Authentication with Refresh Token Rotation

**Status**: ✅ Accepted
**Date**: 2026-03-13
**Deciders**: Engineering team

## 🤔 Context

The platform needs a stateless authentication mechanism that works well with a decoupled frontend (React SPA) and backend (Express API). The chosen approach must balance security, user experience, and implementation complexity.

### The Problem

A single long-lived token is a security liability. If an attacker captures a JWT with a 7-day expiry, they have 7 days of unrestricted access. On the other hand, a very short-lived token (15 minutes) forces the user to re-authenticate constantly, which is a terrible user experience for an e-commerce storefront where users browse, compare products, and complete checkout flows that may take longer than 15 minutes.

We need a mechanism that:

- ✅ Limits the blast radius of token theft to a short window
- ✅ Provides a smooth user experience (no forced re-login during active sessions)
- ✅ Works without server-side session storage for access token validation
- ✅ Detects and responds to token theft attempts

### 🔍 Alternatives Evaluated

| Approach | Verdict | Reasoning |
|----------|---------|-----------|
| **Session-based auth** (server-side sessions in Redis/DB) | ❌ Rejected | Introduces shared state. Complicates horizontal scaling, requires sticky sessions or a shared session store. Adds Redis as an infrastructure dependency |
| **Single long-lived JWT** (7-day expiry) | ❌ Rejected | If the token is compromised, the attacker has a full week of access. No mechanism to revoke the token without maintaining a blocklist (which reintroduces server-side state) |
| **Short-lived JWT only** (15-minute expiry, no refresh) | ❌ Rejected | Forces re-authentication every 15 minutes. Unacceptable UX for an e-commerce platform |
| **JWT with refresh token rotation** | ✅ Selected | Short access token (15 min) limits exposure. Refresh token (7 days) maintains the session. Rotation detects theft. Family-based tracking enables bulk revocation |

## ✅ Decision

We implement JWT-based authentication with **short-lived access tokens** and **refresh token rotation with family-based reuse detection**.

### 🎫 Access Tokens

| Property | Value |
|----------|-------|
| Algorithm | RS256 (asymmetric) |
| Keys | `JWT_PRIVATE_KEY_BASE64` (signing) / `JWT_PUBLIC_KEY_BASE64` (verification) |
| TTL | 15 minutes (configurable via `JWT_ACCESS_EXPIRY`) |
| Transport | `Authorization: Bearer <token>` header |
| Storage (client) | In-memory JavaScript variable (not localStorage) |
| Server-side storage | None (stateless verification) |

The access token payload contains:

```typescript
{
  userId: string;    // User's UUID
  email: string;     // User's email address
  isAdmin: boolean;  // Admin privilege flag
  iat: number;       // Issued at (Unix timestamp)
  exp: number;       // Expiration (Unix timestamp)
}
```

### 🔄 Refresh Tokens

| Property | Value |
|----------|-------|
| Algorithm | RS256 (asymmetric) |
| Keys | `JWT_PRIVATE_KEY_BASE64` (signing) / `JWT_PUBLIC_KEY_BASE64` (verification) |
| TTL | 7 days (configurable via `JWT_REFRESH_EXPIRY`) |
| Transport | JSON response body |
| Storage (client) | Managed by the frontend AuthContext |
| Server-side storage | `refresh_tokens` table in PostgreSQL |

### 👪 Family-Based Rotation

Every refresh token belongs to a **family** identified by a `family_id` UUID. A family represents all tokens originating from a single login event.

**Normal flow:**

```
1. 👤 User logs in
2. 🎫 Server issues AccessToken₁ + RefreshToken₁ (family_id = "abc")
3. ⏰ 15 minutes later, AccessToken₁ expires
4. 🔄 Client sends RefreshToken₁ to /auth/refresh
5. ✅ Server marks RefreshToken₁ as used (sets used_at)
6. 🎫 Server issues AccessToken₂ + RefreshToken₂ (same family_id = "abc")
7. 🔄 Process repeats with RefreshToken₂ → RefreshToken₃, etc.
```

**Reuse detection (theft scenario):**

```
1. 🦹 Attacker steals RefreshToken₂
2. 👤 Legitimate user uses RefreshToken₂ first → gets RefreshToken₃
3. 🦹 Attacker tries to use RefreshToken₂ (already marked as used)
4. 🚨 Server detects reuse: RefreshToken₂ has a non-null used_at
5. 💥 Server revokes ALL tokens in family "abc"
6. 👤 Both attacker and legitimate user must re-authenticate
7. 📝 The legitimate user is protected: the attacker's access is cut off
```

This is a deliberate trade-off. The legitimate user is inconvenienced (forced to log in again), but the attack is neutralized. The alternative (allowing the attacker to continue) is far worse.

### 🔌 Logout

When a user logs out:

1. The current refresh token is deleted from the `refresh_tokens` table
2. The access token remains valid until its natural 15-minute expiry
3. We accept this gap because implementing an access token blocklist would reintroduce server-side state, negating the benefit of stateless JWTs

### 🔄 Client-Side Token Refresh

The React frontend (`AuthContext`) implements proactive token refresh:

- A timer runs every **13 minutes** (2 minutes before the 15-minute access token expiry)
- On 401 responses, the API client automatically attempts a refresh before retrying the failed request
- If the refresh fails, the user is redirected to the sign-in page

## 📊 Consequences

### What becomes easier ✅

- **Horizontal scaling:** Access tokens are verified by checking the signature and expiry, with no database lookup required. Any server instance can validate any token
- **Security posture:** A stolen access token is only useful for 15 minutes maximum. A stolen refresh token triggers reuse detection on the next legitimate use
- **Replay detection:** The family-based rotation model provides a concrete mechanism to detect and respond to token theft
- **Token revocation at logout:** Deleting the refresh token from the database prevents new access tokens from being issued. The short access token TTL limits residual access
- **Audit trail:** The `refresh_tokens` table provides a history of token usage, including when each token was created, used, and which family it belongs to

### What becomes harder ⚠️

- **Client complexity:** The frontend must implement token refresh logic (intercept 401 responses, call `/auth/refresh`, retry the original request, handle race conditions when multiple requests fail simultaneously)
- **Table growth:** The `refresh_tokens` table grows over time as new tokens are issued. Expired entries require periodic cleanup (a scheduled job to delete tokens where `expires_at < NOW()`)
- **Immediate access token revocation:** Revoking an access token before its natural 15-minute expiry requires a token blocklist, which reintroduces server-side state. We accept this trade-off and rely on the short TTL as sufficient mitigation
- **Testing complexity:** Authenticated test flows must manage both token types. The test helpers issue a token pair and handle refresh logic
- **Clock skew sensitivity:** JWT expiration checks depend on synchronized clocks between the server and any load balancers or reverse proxies that inspect tokens

### 🔑 Why HS256 Instead of RS256

The CLAUDE.md guidelines recommend RS256 (asymmetric keys) for multi-service environments. We chose HS256 (symmetric) because:

1. BLE$$ P is a **single-service architecture** (one Express server handles all API requests)
2. No other service needs to verify tokens independently
3. HS256 is simpler to configure (one secret string vs. a key pair)
4. If the architecture evolves to multiple services, migrating to RS256 is a non-breaking change (the token format is identical; only the verification mechanism changes)

This decision is documented here so future contributors understand the rationale and know to revisit it if the architecture becomes multi-service.
