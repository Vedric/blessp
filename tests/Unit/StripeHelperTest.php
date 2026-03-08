<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

final class StripeHelperTest extends \PHPUnit\Framework\TestCase
{
    // ── Amount validation ─────────────────────────────────────────

    public function testValidateAmountAcceptsMinimum(): void
    {
        $this->assertTrue(stripeValidateAmount(50));
    }

    public function testValidateAmountAcceptsLargeAmount(): void
    {
        $this->assertTrue(stripeValidateAmount(999999));
    }

    public function testValidateAmountRejectsBelowMinimum(): void
    {
        $this->assertFalse(stripeValidateAmount(49));
    }

    public function testValidateAmountRejectsZero(): void
    {
        $this->assertFalse(stripeValidateAmount(0));
    }

    public function testValidateAmountRejectsNegative(): void
    {
        $this->assertFalse(stripeValidateAmount(-100));
    }

    // ── Idempotency key generation ────────────────────────────────

    public function testIdempotencyKeyIsConsistentForSameInput(): void
    {
        $key1 = stripeIdempotencyKey(42, 'abc123');
        $key2 = stripeIdempotencyKey(42, 'abc123');
        $this->assertSame($key1, $key2);
    }

    public function testIdempotencyKeyDiffersForDifferentUsers(): void
    {
        $key1 = stripeIdempotencyKey(1, 'same-nonce');
        $key2 = stripeIdempotencyKey(2, 'same-nonce');
        $this->assertNotSame($key1, $key2);
    }

    public function testIdempotencyKeyDiffersForDifferentNonces(): void
    {
        $key1 = stripeIdempotencyKey(1, 'nonce-a');
        $key2 = stripeIdempotencyKey(1, 'nonce-b');
        $this->assertNotSame($key1, $key2);
    }

    public function testIdempotencyKeyIsHexString(): void
    {
        $key = stripeIdempotencyKey(1, 'test');
        $this->assertMatchesRegularExpression('/^[0-9a-f]{64}$/', $key);
    }

    public function testIdempotencyKeyIsSha256Length(): void
    {
        $key = stripeIdempotencyKey(99, 'any-nonce');
        $this->assertSame(64, strlen($key));
    }

    // ── Stripe client creation (missing key) ──────────────────────

    public function testGetClientThrowsWhenSecretKeyMissing(): void
    {
        $originalKey = getenv('STRIPE_SECRET_KEY');
        putenv('STRIPE_SECRET_KEY=');

        try {
            $this->expectException(RuntimeException::class);
            $this->expectExceptionMessage('Stripe is not configured.');
            stripeGetClient();
        } finally {
            if ($originalKey !== false) {
                putenv("STRIPE_SECRET_KEY={$originalKey}");
            }
        }
    }

    public function testGetClientReturnsStripeClientWhenKeyIsSet(): void
    {
        $originalKey = getenv('STRIPE_SECRET_KEY');
        putenv('STRIPE_SECRET_KEY=sk_test_dummy_key_for_testing');

        try {
            $client = stripeGetClient();
            $this->assertInstanceOf(\Stripe\StripeClient::class, $client);
        } finally {
            if ($originalKey !== false) {
                putenv("STRIPE_SECRET_KEY={$originalKey}");
            } else {
                putenv('STRIPE_SECRET_KEY=');
            }
        }
    }

    // ── Webhook verification (missing secret) ─────────────────────

    public function testVerifyWebhookThrowsWhenSecretMissing(): void
    {
        $originalSecret = getenv('STRIPE_WEBHOOK_SECRET');
        putenv('STRIPE_WEBHOOK_SECRET=');

        try {
            $this->expectException(RuntimeException::class);
            $this->expectExceptionMessage('Webhook secret is not configured.');
            stripeVerifyWebhookSignature('{}', 't=123,v1=abc');
        } finally {
            if ($originalSecret !== false) {
                putenv("STRIPE_WEBHOOK_SECRET={$originalSecret}");
            }
        }
    }
}
