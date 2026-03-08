<?php
/**
 * Stripe payment integration helpers.
 *
 * Provides server-side PaymentIntent creation, webhook signature
 * verification, and order persistence after successful payment.
 * All Stripe API keys are loaded from environment variables.
 */

require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/logger.php';

/**
 * Build and return a configured Stripe client instance.
 * Uses the STRIPE_SECRET_KEY environment variable.
 */
function stripeGetClient(): \Stripe\StripeClient {
    $secretKey = getenv('STRIPE_SECRET_KEY');
    if (!$secretKey) {
        logError('STRIPE_SECRET_KEY environment variable is not set');
        throw new RuntimeException('Stripe is not configured.');
    }
    return new \Stripe\StripeClient($secretKey);
}

/**
 * Create a Stripe PaymentIntent for the given amount.
 *
 * @param int    $amountCents   Total in the smallest currency unit (cents)
 * @param string $currency      ISO currency code (e.g. "cad")
 * @param string $idempotencyKey Unique key to prevent duplicate charges
 * @param array<string,string> $metadata  Optional metadata attached to the intent
 * @return array{clientSecret: string, paymentIntentId: string}
 */
function stripeCreatePaymentIntent(
    int $amountCents,
    string $currency,
    string $idempotencyKey,
    array $metadata = []
): array {
    $stripe = stripeGetClient();

    $params = [
        'amount' => $amountCents,
        'currency' => $currency,
        'automatic_payment_methods' => ['enabled' => true],
        'metadata' => $metadata,
    ];

    $intent = $stripe->paymentIntents->create(
        $params,
        ['idempotency_key' => $idempotencyKey]
    );

    logInfo('PaymentIntent created', [
        'paymentIntentId' => $intent->id,
        'amount' => $amountCents,
        'currency' => $currency,
    ]);

    return [
        'clientSecret' => $intent->client_secret,
        'paymentIntentId' => $intent->id,
    ];
}

/**
 * Verify a Stripe webhook signature and return the parsed event.
 *
 * @param string $payload   Raw request body
 * @param string $sigHeader Value of the Stripe-Signature header
 * @return \Stripe\Event
 * @throws \Stripe\Exception\SignatureVerificationException on invalid signature
 */
function stripeVerifyWebhookSignature(string $payload, string $sigHeader): \Stripe\Event {
    $webhookSecret = getenv('STRIPE_WEBHOOK_SECRET');
    if (!$webhookSecret) {
        logError('STRIPE_WEBHOOK_SECRET environment variable is not set');
        throw new RuntimeException('Webhook secret is not configured.');
    }

    return \Stripe\Webhook::constructEvent($payload, $sigHeader, $webhookSecret);
}

/**
 * Validate the amount for a PaymentIntent.
 * Stripe requires a minimum of 50 cents for most currencies.
 *
 * @param int $amountCents Amount in cents
 * @return bool
 */
function stripeValidateAmount(int $amountCents): bool {
    return $amountCents >= 50;
}

/**
 * Generate an idempotency key from user ID and a client-provided nonce.
 * This prevents duplicate PaymentIntents if the user double-clicks.
 *
 * @param int    $userId
 * @param string $nonce  Client-provided unique string per checkout attempt
 * @return string
 */
function stripeIdempotencyKey(int $userId, string $nonce): string {
    return hash('sha256', "stripe_pi_{$userId}_{$nonce}");
}
