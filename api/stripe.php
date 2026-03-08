<?php
include "../config.php";

include "./helper.php";

include_once __DIR__ . "/../stripe_helper.php";
include_once __DIR__ . "/../logger.php";

// CSRF required on payment intent creation (POST), but NOT on webhooks
if ($method === 'POST' && $path !== '/webhook') {
    csrfProtect();
}

try {
    if ($method === 'POST' && $path === '/create_payment_intent') {
        handleCreatePaymentIntent($CONFIG);
    }

    if ($method === 'POST' && $path === '/webhook') {
        handleWebhook($CONFIG);
    }

    jsonResponse(['error' => 'not_found', 'message' => 'Route not found: ' . $path], 404);

} catch (\Stripe\Exception\ApiErrorException $e) {
    logError('Stripe API error', ['exception' => $e->getMessage()]);
    jsonResponse(['error' => 'payment_error', 'message' => 'Payment processing failed. Please try again.'], 502);
} catch (Exception $e) {
    logError('Unhandled exception', ['exception' => $e->getMessage(), 'file' => $e->getFile(), 'line' => $e->getLine()]);
    jsonResponse(['error' => 'server_error', 'message' => 'An unexpected error occurred.'], 500);
}

/**
 * POST /create_payment_intent
 *
 * Creates a Stripe PaymentIntent for the checkout amount.
 * Requires authentication and a valid CSRF token.
 */
function handleCreatePaymentIntent(array $CONFIG): void {
    $user = getAuthenticatedUser($CONFIG);
    if (!$user) {
        jsonResponse(['error' => 'unauthenticated', 'message' => 'You must be logged in to pay.'], 401);
    }

    $data = getJsonInput();

    $amount = $data['amount'] ?? null;
    $currency = $data['currency'] ?? 'cad';
    $nonce = $data['nonce'] ?? null;

    if ($amount === null || !is_numeric($amount)) {
        jsonResponse(['error' => 'invalid_input', 'message' => 'A valid amount is required.'], 400);
    }

    if (empty($nonce) || !is_string($nonce) || strlen($nonce) > 128) {
        jsonResponse(['error' => 'invalid_input', 'message' => 'A valid nonce is required for idempotency.'], 400);
    }

    // Convert dollar amount to cents
    $amountCents = (int)round((float)$amount * 100);

    if (!stripeValidateAmount($amountCents)) {
        jsonResponse(['error' => 'invalid_input', 'message' => 'Amount must be at least $0.50.'], 400);
    }

    $allowedCurrencies = ['cad', 'usd', 'eur'];
    $currency = strtolower(trim($currency));
    if (!in_array($currency, $allowedCurrencies, true)) {
        jsonResponse(['error' => 'invalid_input', 'message' => 'Unsupported currency.'], 400);
    }

    $idempotencyKey = stripeIdempotencyKey((int)$user['id'], $nonce);

    $result = stripeCreatePaymentIntent(
        $amountCents,
        $currency,
        $idempotencyKey,
        ['user_id' => (string)$user['id']]
    );

    jsonResponse([
        'clientSecret' => $result['clientSecret'],
        'paymentIntentId' => $result['paymentIntentId'],
    ]);
}

/**
 * POST /webhook
 *
 * Handles Stripe webhook events. No authentication or CSRF required;
 * the webhook signature is used for verification instead.
 */
function handleWebhook(array $CONFIG): void {
    $payload = file_get_contents('php://input');
    $sigHeader = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

    if (empty($sigHeader)) {
        jsonResponse(['error' => 'invalid_signature', 'message' => 'Missing Stripe-Signature header.'], 400);
    }

    try {
        $event = stripeVerifyWebhookSignature($payload, $sigHeader);
    } catch (\Stripe\Exception\SignatureVerificationException $e) {
        logWarn('Webhook signature verification failed', ['exception' => $e->getMessage()]);
        jsonResponse(['error' => 'invalid_signature', 'message' => 'Invalid webhook signature.'], 400);
    }

    logInfo('Stripe webhook received', ['type' => $event->type, 'id' => $event->id]);

    switch ($event->type) {
        case 'payment_intent.succeeded':
            handlePaymentIntentSucceeded($event->data->object, $CONFIG);
            break;

        case 'payment_intent.payment_failed':
            handlePaymentIntentFailed($event->data->object);
            break;

        default:
            logInfo('Unhandled webhook event type', ['type' => $event->type]);
            break;
    }

    // Acknowledge receipt
    jsonResponse(['received' => true]);
}

/**
 * Handle a successful PaymentIntent. Updates the order status
 * if the order was already persisted with a pending status.
 */
function handlePaymentIntentSucceeded(object $paymentIntent, array $CONFIG): void {
    $transactionKey = $paymentIntent->id;

    logInfo('Payment succeeded', [
        'paymentIntentId' => $transactionKey,
        'amount' => $paymentIntent->amount,
        'currency' => $paymentIntent->currency,
    ]);

    $pdo = getPDO($CONFIG);
    $stmt = $pdo->prepare('UPDATE orders SET status = :status WHERE transaction_key = :transaction_key AND status != :already_paid');
    $stmt->execute([
        ':status' => 'PAYED',
        ':transaction_key' => $transactionKey,
        ':already_paid' => 'PAYED',
    ]);

    if ($stmt->rowCount() > 0) {
        logInfo('Order status updated to PAYED via webhook', ['transactionKey' => $transactionKey]);
    }
}

/**
 * Handle a failed PaymentIntent. Logs the failure for monitoring.
 */
function handlePaymentIntentFailed(object $paymentIntent): void {
    $lastError = $paymentIntent->last_payment_error;
    logWarn('Payment failed', [
        'paymentIntentId' => $paymentIntent->id,
        'errorCode' => $lastError->code ?? 'unknown',
        'errorMessage' => $lastError->message ?? 'No details available',
    ]);
}
?>
