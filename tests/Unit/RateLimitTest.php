<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class RateLimitTest extends TestCase
{
    private string $storageDir;

    protected function setUp(): void
    {
        $this->storageDir = sys_get_temp_dir() . '/blessp_rate_limit';
        // Set a known IP for rate limit tests
        $_SERVER['REMOTE_ADDR'] = '127.0.0.1';
    }

    protected function tearDown(): void
    {
        // Clean up rate limit files
        if (is_dir($this->storageDir)) {
            $files = glob($this->storageDir . '/*');
            if ($files) {
                foreach ($files as $file) {
                    if (is_file($file)) {
                        unlink($file);
                    }
                }
            }
        }
    }

    // ── rateLimitLoginFailed / rateLimitIsAccountLocked ────────────

    public function testAccountNotLockedWithNoFailedAttempts(): void
    {
        $this->assertFalse(
            rateLimitIsAccountLocked('test@example.com', 5, 900)
        );
    }

    public function testAccountLockedAfterMaxAttempts(): void
    {
        $email = 'locked@example.com';

        for ($i = 0; $i < 5; $i++) {
            rateLimitLoginFailed($email, 5, 900);
        }

        $this->assertTrue(rateLimitIsAccountLocked($email, 5, 900));
    }

    public function testAccountNotLockedBelowMaxAttempts(): void
    {
        $email = 'notlocked@example.com';

        for ($i = 0; $i < 4; $i++) {
            rateLimitLoginFailed($email, 5, 900);
        }

        $this->assertFalse(rateLimitIsAccountLocked($email, 5, 900));
    }

    public function testClearLoginFailedResetsCounter(): void
    {
        $email = 'clear@example.com';

        for ($i = 0; $i < 5; $i++) {
            rateLimitLoginFailed($email, 5, 900);
        }

        $this->assertTrue(rateLimitIsAccountLocked($email, 5, 900));

        rateLimitClearLoginFailed($email);

        $this->assertFalse(rateLimitIsAccountLocked($email, 5, 900));
    }

    public function testClearLoginFailedOnNonExistentFileDoesNotError(): void
    {
        // Should not throw any exception
        rateLimitClearLoginFailed('nonexistent@example.com');

        $this->assertFalse(rateLimitIsAccountLocked('nonexistent@example.com', 5, 900));
    }

    public function testDifferentEmailsTrackedSeparately(): void
    {
        $email1 = 'user1@example.com';
        $email2 = 'user2@example.com';

        for ($i = 0; $i < 5; $i++) {
            rateLimitLoginFailed($email1, 5, 900);
        }

        $this->assertTrue(rateLimitIsAccountLocked($email1, 5, 900));
        $this->assertFalse(rateLimitIsAccountLocked($email2, 5, 900));
    }

    public function testExpiredAttemptsAreNotCounted(): void
    {
        $email = 'expired@example.com';
        $safeKey = 'login_failed_' . preg_replace('/[^a-zA-Z0-9_\-]/', '_', $email);
        $filePath = $this->storageDir . '/' . $safeKey;

        if (!is_dir($this->storageDir)) {
            mkdir($this->storageDir, 0700, true);
        }

        // Write timestamps that are already expired (2 hours old)
        $expiredTimestamp = time() - 7200;
        $timestamps = array_fill(0, 10, $expiredTimestamp);
        file_put_contents($filePath, implode("\n", $timestamps), LOCK_EX);

        // With a 900-second window, all old timestamps should be pruned
        $this->assertFalse(rateLimitIsAccountLocked($email, 5, 900));
    }

    // ── rateLimitCheck ────────────────────────────────────────────

    public function testRateLimitCheckAllowsWithinLimit(): void
    {
        // Clean slate: should be well within limit
        $result = rateLimitCheck('test_action_' . uniqid(), 100, 900);

        $this->assertTrue($result);
    }
}
