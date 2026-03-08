<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

final class LoggerTest extends \PHPUnit\Framework\TestCase
{
    // ── Log level resolution ─────────────────────────────────────

    public function testLoggerGetLevelReturnsInteger(): void
    {
        $level = loggerGetLevel();
        $this->assertIsInt($level);
    }

    public function testLogLevelConstants(): void
    {
        $this->assertSame(0, BLESSP_LOG_LEVEL_DEBUG);
        $this->assertSame(1, BLESSP_LOG_LEVEL_INFO);
        $this->assertSame(2, BLESSP_LOG_LEVEL_WARN);
        $this->assertSame(3, BLESSP_LOG_LEVEL_ERROR);
        $this->assertLessThan(BLESSP_LOG_LEVEL_ERROR, BLESSP_LOG_LEVEL_DEBUG);
    }

    // ── Request ID ───────────────────────────────────────────────

    public function testLoggerRequestIdReturnsConsistentValue(): void
    {
        $id1 = loggerRequestId();
        $id2 = loggerRequestId();
        $this->assertSame($id1, $id2);
    }

    public function testLoggerRequestIdIsHexString(): void
    {
        $id = loggerRequestId();
        $this->assertMatchesRegularExpression('/^[0-9a-f]+$/', $id);
    }

    // ── Redaction ────────────────────────────────────────────────

    public function testRedactRemovesSensitiveKeys(): void
    {
        $result = loggerRedact([
            'email' => 'user@example.com',
            'password' => 'secret123',
            'token' => 'abc-def',
        ]);

        $this->assertSame('user@example.com', $result['email']);
        $this->assertSame('[REDACTED]', $result['password']);
        $this->assertSame('[REDACTED]', $result['token']);
    }

    public function testRedactHandlesNestedArrays(): void
    {
        $result = loggerRedact([
            'user' => ['name' => 'Alice', 'password_hash' => '$argon2id$...'],
        ]);

        $this->assertSame('Alice', $result['user']['name']);
        $this->assertSame('[REDACTED]', $result['user']['password_hash']);
    }

    public function testRedactIsCaseInsensitive(): void
    {
        $result = loggerRedact(['Password' => 'secret', 'API_KEY' => 'key123']);

        $this->assertSame('[REDACTED]', $result['Password']);
        $this->assertSame('[REDACTED]', $result['API_KEY']);
    }

    public function testRedactPreservesNonSensitiveKeys(): void
    {
        $result = loggerRedact(['status' => 'ok', 'count' => 42]);

        $this->assertSame('ok', $result['status']);
        $this->assertSame(42, $result['count']);
    }

    public function testRedactHandlesEmptyArray(): void
    {
        $this->assertSame([], loggerRedact([]));
    }

    public function testRedactCoversAllSensitiveFields(): void
    {
        $sensitiveKeys = [
            'password', 'password_hash', 'token', 'session_token',
            'authorization', 'cookie', 'csrf_token', 'secret',
            'api_key', 'credit_card', 'card_number',
        ];

        $input = [];
        foreach ($sensitiveKeys as $key) {
            $input[$key] = 'value';
        }

        $result = loggerRedact($input);

        foreach ($sensitiveKeys as $key) {
            $this->assertSame('[REDACTED]', $result[$key], "Key '{$key}' should be redacted");
        }
    }

    // ── Convenience functions exist ──────────────────────────────

    public function testConvenienceFunctionsExist(): void
    {
        $this->assertTrue(function_exists('logDebug'));
        $this->assertTrue(function_exists('logInfo'));
        $this->assertTrue(function_exists('logWarn'));
        $this->assertTrue(function_exists('logError'));
        $this->assertTrue(function_exists('loggerWrite'));
    }

    // ── JSON output format (subprocess) ──────────────────────────

    public function testLoggerWriteProducesValidJson(): void
    {
        $loggerPath = dirname(__DIR__, 2) . '/logger.php';
        $script = <<<PHP
            require_once '$loggerPath';
            loggerWrite('error', 'test message', ['key' => 'value']);
        PHP;

        $stderr = $this->runPhpAndCaptureStderr($script);
        $decoded = json_decode(trim($stderr), true);

        $this->assertNotNull($decoded, "Logger output should be valid JSON, got: {$stderr}");
        $this->assertSame('error', $decoded['level']);
        $this->assertSame('test message', $decoded['message']);
        $this->assertArrayHasKey('timestamp', $decoded);
        $this->assertArrayHasKey('requestId', $decoded);
        $this->assertSame('value', $decoded['context']['key']);
    }

    public function testLoggerWriteRedactsSensitiveContext(): void
    {
        $loggerPath = dirname(__DIR__, 2) . '/logger.php';
        $script = <<<PHP
            require_once '$loggerPath';
            loggerWrite('error', 'auth attempt', ['password' => 'hunter2', 'email' => 'a@b.com']);
        PHP;

        $stderr = $this->runPhpAndCaptureStderr($script);
        $decoded = json_decode(trim($stderr), true);

        $this->assertNotNull($decoded);
        $this->assertSame('[REDACTED]', $decoded['context']['password']);
        $this->assertSame('a@b.com', $decoded['context']['email']);
    }

    public function testLoggerWriteTimestampIsIso8601(): void
    {
        $loggerPath = dirname(__DIR__, 2) . '/logger.php';
        $script = <<<PHP
            require_once '$loggerPath';
            logError('ts test');
        PHP;

        $stderr = $this->runPhpAndCaptureStderr($script);
        $decoded = json_decode(trim($stderr), true);

        $this->assertNotNull($decoded);
        $this->assertMatchesRegularExpression(
            '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/',
            $decoded['timestamp']
        );
    }

    // ── Helpers ──────────────────────────────────────────────────

    private function runPhpAndCaptureStderr(string $script): string
    {
        $proc = proc_open(
            ['php', '-r', $script],
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes
        );
        if (!is_resource($proc)) {
            $this->fail('Could not spawn PHP subprocess');
        }

        fclose($pipes[0]);
        fclose($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[2]);
        proc_close($proc);

        return $stderr;
    }
}
