# 008. GDPR Data Deletion

**Status**: Active
**Last reviewed**: 2026-03-16

## Summary

Procedures for processing GDPR "right to erasure" (Article 17) requests and subject
access requests (Article 15) in the BLE$P platform. Documents what the
`DELETE /api/v1/users/account` endpoint does, how to verify deletion completeness, the
data retention policy, and manual steps for requests that fall outside the self-service
flow.

## When to use this runbook

- A customer submits a data deletion request via the account settings page or by email.
- A data protection authority contacts us regarding a deletion or access request.
- We need to verify that a previously processed deletion was complete.
- A customer requests a copy of all personal data we hold (subject access request).
- An audit requires documentation of our data deletion procedures.

## Prerequisites

- Access to the production database (read access for verification, write access for
  manual deletions).
- Access to the Stripe dashboard to verify payment method detachment.
- Access to application logs for audit trail review.
- Familiarity with the `UsersService.deleteAccount()` method and its side effects.
- Knowledge of applicable data retention obligations (tax records, fraud prevention).

## Steps

### 1. Identify the request type

| Request type | GDPR article | Response deadline | Action |
|-------------|-------------|-------------------|--------|
| Right to erasure | Article 17 | 30 days | Delete personal data (soft delete, token revocation, payment method detachment) |
| Subject access request (SAR) | Article 15 | 30 days | Provide a copy of all personal data held |
| Rectification | Article 16 | 30 days | Correct inaccurate personal data |

### 2. Process a deletion request via the self-service endpoint

The primary deletion flow is the `DELETE /api/v1/users/account` endpoint, which requires
the user to authenticate and confirm their password. The endpoint performs the following
actions in sequence:

1. **Password verification**: The user must provide their current password to confirm
   the deletion. This prevents unauthorized account deletion via stolen tokens.

2. **Refresh token revocation**: All refresh tokens for the user are deleted from the
   `refresh_tokens` table via `authRepository.deleteByUserId(userId)`. This immediately
   invalidates all active sessions across all devices.

3. **Stripe payment method detachment**: All payment methods attached to the user's
   Stripe customer record are detached via
   `paymentsService.detachAllPaymentMethods(userId)`. This ensures no orphaned payment
   methods remain on the Stripe side. If Stripe is not configured, this step is skipped
   gracefully.

4. **Soft delete**: The user record is soft-deleted by setting the `deleted_at` timestamp
   via `usersRepository.softDelete(userId)`. The record remains in the database for the
   retention period but is excluded from all application queries.

The endpoint logs `Account soft-deleted per user request` with the user ID for audit
purposes.

### 3. Process a deletion request manually (when the user cannot self-serve)

If the user can no longer access their account (e.g., forgotten password, locked out),
process the deletion manually:

#### 3.1 Verify the requester's identity

Before processing any manual deletion, verify the requester's identity using at least
two of the following:

- Email address on file.
- Order history details (order IDs, amounts, dates).
- Billing address or payment card last four digits.
- Government-issued ID (for high-risk requests).

Document the verification method used.

#### 3.2 Look up the user

```bash
docker compose exec db psql -U blessp -d blessp -c "
  SELECT id, email, first_name, last_name, created_at, deleted_at
  FROM users
  WHERE email = '<user-email>'
  LIMIT 1;
"
```

#### 3.3 Revoke all refresh tokens

```bash
docker compose exec db psql -U blessp -d blessp -c "
  DELETE FROM refresh_tokens
  WHERE user_id = '<user-id>';
"
```

#### 3.4 Detach Stripe payment methods

1. Look up the Stripe customer ID:

```bash
docker compose exec db psql -U blessp -d blessp -c "
  SELECT stripe_customer_id
  FROM stripe_customers
  WHERE user_id = '<user-id>';
"
```

2. In the Stripe dashboard, navigate to the customer record using the `stripe_customer_id`.
3. Detach all payment methods from the customer.

Alternatively, use the Stripe CLI:

```bash
# List payment methods
stripe payment_methods list --customer <stripe-customer-id> --type card

# Detach each payment method
stripe payment_methods detach <payment-method-id>
```

#### 3.5 Soft-delete the user record

```bash
docker compose exec db psql -U blessp -d blessp -c "
  UPDATE users
  SET deleted_at = NOW(), updated_at = NOW()
  WHERE id = '<user-id>'
    AND deleted_at IS NULL;
"
```

#### 3.6 Log the manual deletion

Record the deletion in the application logs or an internal tracking system:

- User ID
- Deletion date
- Identity verification method used
- Team member who performed the deletion

### 4. Data retention policy

Soft-deleted user records are retained for the following periods before permanent
removal:

| Data category | Retention period | Justification |
|--------------|-----------------|---------------|
| User profile (soft-deleted) | 30 days | Recovery window for accidental deletion |
| Order history | 7 years | Tax and accounting obligations |
| Payment records (Stripe references) | 7 years | Financial compliance |
| Application logs containing user ID | 90 days | Operational troubleshooting |
| Refresh tokens | Deleted immediately | No retention required |
| Stripe payment methods | Detached immediately | No retention required |

After the 30-day recovery window, personal data fields in the user record (email,
first name, last name) should be anonymized while preserving the record structure for
referential integrity with retained orders.

### 5. Handle a subject access request (SAR)

When a customer requests a copy of their personal data:

#### 5.1 Gather all personal data

```bash
# User profile
docker compose exec db psql -U blessp -d blessp -c "
  SELECT id, email, first_name, last_name, is_admin, created_at, updated_at
  FROM users
  WHERE id = '<user-id>';
"

# Orders
docker compose exec db psql -U blessp -d blessp -c "
  SELECT id, status, total_cents, shipping_address_city,
         shipping_address_province, shipping_address_country,
         created_at
  FROM orders
  WHERE user_id = '<user-id>'
  ORDER BY created_at DESC;
"

# Order items
docker compose exec db psql -U blessp -d blessp -c "
  SELECT oi.id, oi.product_id, oi.quantity, oi.unit_price_cents,
         oi.size, oi.color
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.user_id = '<user-id>';
"

# Email preferences
docker compose exec db psql -U blessp -d blessp -c "
  SELECT order_updates, promotions, newsletter, loyalty_alerts
  FROM email_preferences
  WHERE user_id = '<user-id>';
"

# Stripe customer mapping
docker compose exec db psql -U blessp -d blessp -c "
  SELECT stripe_customer_id, created_at
  FROM stripe_customers
  WHERE user_id = '<user-id>';
"

# Loyalty points
docker compose exec db psql -U blessp -d blessp -c "
  SELECT points, tier, created_at, updated_at
  FROM loyalty_accounts
  WHERE user_id = '<user-id>';
"
```

#### 5.2 Compile and deliver the data

1. Export the query results to a structured format (JSON or CSV).
2. Review the export to ensure no other user's data is included.
3. Deliver the data securely to the requester (encrypted email, secure file share).
4. Document the SAR completion date and delivery method.

### 6. Verify deletion completeness

After processing a deletion (whether self-service or manual), verify:

```bash
# Confirm user is soft-deleted
docker compose exec db psql -U blessp -d blessp -c "
  SELECT id, email, deleted_at
  FROM users
  WHERE id = '<user-id>';
"
# Expected: deleted_at should be non-null

# Confirm no active refresh tokens remain
docker compose exec db psql -U blessp -d blessp -c "
  SELECT COUNT(*)
  FROM refresh_tokens
  WHERE user_id = '<user-id>';
"
# Expected: 0

# Confirm Stripe payment methods were detached
# Check the Stripe dashboard or use the CLI:
stripe payment_methods list --customer <stripe-customer-id> --type card
# Expected: empty list

# Confirm the user cannot authenticate
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "<user-email>", "password": "<any-password>"}'
# Expected: 401 Unauthorized (user record excluded by soft-delete filter)
```

## Verification

- [ ] User record has a non-null `deleted_at` timestamp.
- [ ] No refresh tokens exist for the user ID.
- [ ] No payment methods remain attached to the user's Stripe customer.
- [ ] The user cannot log in or access any authenticated endpoint.
- [ ] Application logs contain the `Account soft-deleted per user request` entry.
- [ ] The deletion was completed within the 30-day GDPR deadline.
- [ ] An internal record of the deletion request and completion exists for audit purposes.

## Rollback procedure

### If a deletion was performed in error (within the 30-day retention window)

1. Restore the user record by clearing the `deleted_at` field:

```bash
docker compose exec db psql -U blessp -d blessp -c "
  UPDATE users
  SET deleted_at = NULL, updated_at = NOW()
  WHERE id = '<user-id>';
"
```

2. The user will need to log in again (refresh tokens were deleted). No further action
   is needed as a new refresh token family will be created on login.

3. Payment methods will need to be re-added by the user through the account settings
   page, as detached methods cannot be automatically reattached.

### If the 30-day retention window has passed

If personal data has been anonymized after the retention period, restoration is not
possible. Inform the user that a new account must be created.

### If a subject access request response was incorrect

If a SAR response contained incorrect or incomplete data:

1. Re-run the data gathering queries (step 5.1).
2. Issue a corrected export to the requester.
3. Document the correction.

## Escalation contacts

| Role | Contact |
|------|---------|
| Backend Lead | Internal team channel |
| Data Protection Officer | Internal team channel |
| Legal / Compliance | Internal team channel |
| Stripe Support | Stripe dashboard (for payment method issues) |
