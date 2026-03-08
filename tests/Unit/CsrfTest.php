<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class CsrfTest extends TestCase
{
    protected function setUp(): void
    {
        // Ensure session is available for tests
        if (session_status() === PHP_SESSION_NONE) {
            // Prevent "headers already sent" in CLI
            @session_start();
        }
        // Clear any existing CSRF token
        unset($_SESSION['csrf_token']);
    }

    protected function tearDown(): void
    {
        unset($_SESSION['csrf_token']);
    }

    // ── csrfGenerateToken ─────────────────────────────────────────

    public function testGenerateTokenReturnsHexString(): void
    {
        $token = csrfGenerateToken();

        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $token);
    }

    public function testGenerateTokenStoresInSession(): void
    {
        $token = csrfGenerateToken();

        $this->assertSame($token, $_SESSION['csrf_token']);
    }

    public function testGenerateTokenReturnsSameTokenOnSubsequentCalls(): void
    {
        $token1 = csrfGenerateToken();
        $token2 = csrfGenerateToken();

        $this->assertSame($token1, $token2);
    }

    // ── csrfGetToken ──────────────────────────────────────────────

    public function testGetTokenGeneratesWhenMissing(): void
    {
        $token = csrfGetToken();

        $this->assertNotEmpty($token);
        $this->assertSame(64, strlen($token));
    }

    public function testGetTokenReturnsExistingToken(): void
    {
        $_SESSION['csrf_token'] = 'existing_test_token_value';

        $token = csrfGetToken();

        $this->assertSame('existing_test_token_value', $token);
    }

    // ── csrfValidateToken ─────────────────────────────────────────

    public function testValidateTokenReturnsTrueForMatchingToken(): void
    {
        $token = csrfGenerateToken();

        $this->assertTrue(csrfValidateToken($token));
    }

    public function testValidateTokenReturnsFalseForWrongToken(): void
    {
        csrfGenerateToken();

        $this->assertFalse(csrfValidateToken('wrong_token'));
    }

    public function testValidateTokenReturnsFalseForNull(): void
    {
        csrfGenerateToken();

        $this->assertFalse(csrfValidateToken(null));
    }

    public function testValidateTokenReturnsFalseForEmptyString(): void
    {
        csrfGenerateToken();

        $this->assertFalse(csrfValidateToken(''));
    }

    public function testValidateTokenReturnsFalseWhenNoSessionToken(): void
    {
        // No token generated in session
        $this->assertFalse(csrfValidateToken('any_token'));
    }

    // ── csrfMetaTag ───────────────────────────────────────────────

    public function testMetaTagContainsToken(): void
    {
        $token = csrfGenerateToken();
        $meta = csrfMetaTag();

        $this->assertStringContainsString('name="csrf-token"', $meta);
        $this->assertStringContainsString('content="' . $token . '"', $meta);
        $this->assertStringStartsWith('<meta ', $meta);
    }

    public function testMetaTagEscapesSpecialCharacters(): void
    {
        // Inject a token with characters that need HTML escaping
        $_SESSION['csrf_token'] = 'token"with<special>&chars';

        $meta = csrfMetaTag();

        $this->assertStringNotContainsString('"with<special>"', $meta);
        $this->assertStringContainsString('&amp;', $meta);
    }
}
