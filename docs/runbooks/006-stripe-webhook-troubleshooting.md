# 006. Stripe Webhook Troubleshooting

**Status**: Active
**Last reviewed**: 2026-03-16

## Summary

Procedures for diagnosing and resolving Stripe webhook delivery issues in the BLE$P
platform. Covers signature verification failures, missed events, duplicate event
processing, raw body parsing problems, and how to replay events from the Stripe dashboard.

## When to use this runbook

- Application logs contain `Stripe webhook signature verification failed` entries.
- Orders remain in `pending` status after successful payment on the Stripe side.
- Duplicate order status transitions or loyalty point awards are observed.
- The Stripe dashboard shows failed webhook delivery attempts.
- A `STRIPE_WEBHOOK_SECRET` rotation has been performed and webhooks stopped working.

## Prerequisites

- Access to the Stripe dashboard (Developers > Webhooks and Developers > Logs).
- Access to application logs via Docker Compose or the log aggregation platform.
- SSH access to the production host.
- Familiarity with the webhook route: `POST /api/v1/payments/webhook`.
- Familiarity with `005-secret-rotation.md` for webhook secret rotation procedures.

## Steps

### 1. Confirm the symptom

Determine which failure mode applies:

| Symptom | Likely cause |
|---------|-------------|
| `Stripe webhook signature verification failed` in logs | Incorrect `STRIPE_WEBHOOK_SECRET`, raw body not available, or clock skew |
| Orders stuck in `pending` despite payment on Stripe | Webhook not reaching the application, or event type not handled |
| Duplicate loyalty points or duplicate log entries | Idempotency check bypassed, or event replayed without deduplication |
| 400 response with `MISSING_SIGNATURE` | Stripe is not sending the `stripe-signature` header (unlikely), or a proxy is stripping it |

### 2. Check the Stripe dashboard for delivery status

1. Log in to the Stripe dashboard.
2. Navigate to **Developers > Webhooks**.
3. Select the webhook endpoint configured for BLE$P.
4. Review **Recent events**: look for events with a non-2xx response status.
5. Click on a failing event to see the request payload and the response body returned
   by our application.

Key things to check:

- Is the endpoint URL correct and reachable from the internet?
- Is the endpoint using HTTPS?
- What HTTP status code is the application returning (400, 500, timeout)?

### 3. Verify the `STRIPE_WEBHOOK_SECRET` environment variable

The webhook signing secret must match the secret shown in the Stripe dashboard for the
configured endpoint.

```bash
# Check that the variable is set (do not log the actual value)
docker compose exec app printenv STRIPE_WEBHOOK_SECRET | wc -c
# Expected: a non-zero character count (typically 25+ characters)
```

If the secret was recently rotated, confirm the rotation was completed:

1. Open the Stripe dashboard, navigate to **Developers > Webhooks**.
2. Click the endpoint and locate the **Signing secret** value.
3. Compare the prefix (`whsec_...`) with the value in the environment.

If the values do not match, update `STRIPE_WEBHOOK_SECRET` in the environment
configuration and restart the application:

```bash
docker compose up -d --no-deps app
```

### 4. Verify raw body parsing

Stripe signature verification requires the raw (unparsed) request body. The BLE$P webhook
route is configured with `express.raw({ type: 'application/json' })` to ensure the body
arrives as a `Buffer` rather than a parsed JSON object.

If a middleware or proxy upstream of the webhook route parses the body first, signature
verification will fail.

```bash
# Check application logs for signature failures around the time of the issue
docker compose logs --tail=500 app 2>&1 | grep -i "webhook signature"
```

Common causes of raw body issues:

- A global `express.json()` middleware applied before the webhook route intercepts the
  request and parses the body.
- A reverse proxy (nginx, Cloudflare) modifies or re-encodes the request body.

To confirm whether the raw body is the problem, temporarily add debug logging to the
webhook handler (development only, never in production) or check that the route ordering
in `payments.router.ts` places the `express.raw()` middleware directly on the webhook
route.

### 5. Check for missed events

If events were not received at all (no log entries, no Stripe delivery attempts):

1. Verify the webhook endpoint URL in the Stripe dashboard points to the correct host
   and path: `https://<your-domain>/api/v1/payments/webhook`.
2. Verify the endpoint is configured to receive the required event types:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
3. Check network connectivity: ensure the production host accepts inbound HTTPS traffic
   on port 443 from Stripe's IP ranges.
4. Check for firewall rules, WAF rules, or rate limiters that might be blocking Stripe
   requests.

### 6. Handle duplicate event processing

The BLE$P webhook handler includes an idempotency check for `payment_intent.succeeded`:
if the order status is already `paid`, the duplicate event is logged and skipped.

If duplicate processing is still occurring:

1. Check whether multiple webhook endpoints are configured in Stripe for the same
   environment. Each endpoint receives its own copy of every event.
2. Check whether Stripe is retrying a previously failed delivery. Stripe retries up to
   three times with exponential backoff.
3. Verify the idempotency check in `payments.service.ts` is functioning by reviewing
   application logs for the message `Payment already processed, skipping duplicate webhook`.

### 7. Replay events from Stripe

If events were missed and need to be reprocessed:

1. In the Stripe dashboard, navigate to **Developers > Events**.
2. Filter by event type (e.g., `payment_intent.succeeded`) and date range.
3. Click on the event and select **Resend** to redeliver it to the configured endpoint.

Alternatively, use the Stripe CLI for bulk replay:

```bash
# Replay a specific event
stripe events resend evt_1234567890

# List recent events of a given type
stripe events list --type payment_intent.succeeded --limit 10
```

Before replaying, confirm the application's idempotency checks are in place to prevent
duplicate side effects.

### 8. Test webhook delivery locally

For debugging in a development environment, use the Stripe CLI to forward events:

```bash
# Forward events to the local development server
stripe listen --forward-to http://localhost:3000/api/v1/payments/webhook

# Trigger a test event
stripe trigger payment_intent.succeeded
```

The Stripe CLI will display the webhook signing secret to use locally (starts with
`whsec_`). Set this value as `STRIPE_WEBHOOK_SECRET` in the development `.env` file.

## Verification

- [ ] Webhook events appear in application logs with `Processing` or `Payment succeeded` messages.
- [ ] The Stripe dashboard shows 2xx responses for recent webhook deliveries.
- [ ] Orders transition from `pending` to `paid` after successful payment.
- [ ] No `Stripe webhook signature verification failed` entries in recent logs.
- [ ] Loyalty points are awarded exactly once per completed order.
- [ ] `/health/ready` returns 200.

## Rollback procedure

Webhook configuration changes are non-destructive, so rollback is straightforward:

### If the webhook secret was changed incorrectly

1. Revert `STRIPE_WEBHOOK_SECRET` to the previous value in the environment configuration.
2. Restart the application:

```bash
docker compose up -d --no-deps app
```

3. Confirm webhook deliveries resume successfully in the Stripe dashboard.

### If events were missed during an outage

1. Identify the time window of the outage.
2. Replay missed events from the Stripe dashboard (see step 7 above).
3. Verify each replayed order reaches the correct status in the database.

### If the webhook endpoint URL was changed incorrectly

1. Update the endpoint URL in the Stripe dashboard back to the correct value.
2. Resend any failed events from the event log.

## Escalation contacts

| Role | Contact |
|------|---------|
| Backend Lead | Internal team channel |
| DevOps / Infrastructure | Internal team channel |
| Stripe Support | Stripe dashboard (for account-level issues or persistent delivery failures) |
