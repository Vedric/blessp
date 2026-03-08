<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class ConfigTest extends TestCase
{
    // ── getConfig ─────────────────────────────────────────────────

    public function testGetConfigReturnsArray(): void
    {
        $config = getConfig();

        $this->assertIsArray($config);
    }

    public function testGetConfigContainsRequiredKeys(): void
    {
        $config = getConfig();

        $requiredKeys = [
            'db_dsn',
            'db_user',
            'db_pass',
            'cookie_name',
            'session_lifetime_seconds',
            'cookie_path',
            'cookie_secure',
            'cookie_httponly',
            'cookie_samesite',
            'version',
            'taxe_rate',
        ];

        foreach ($requiredKeys as $key) {
            $this->assertArrayHasKey($key, $config, "Missing config key: {$key}");
        }
    }

    public function testCookieNameIsSessionToken(): void
    {
        $config = getConfig();

        $this->assertSame('session_token', $config['cookie_name']);
    }

    public function testCookieHttponlyIsTrue(): void
    {
        $config = getConfig();

        $this->assertTrue($config['cookie_httponly']);
    }

    public function testCookieSameSiteIsStrict(): void
    {
        $config = getConfig();

        $this->assertSame('Strict', $config['cookie_samesite']);
    }

    public function testCookiePathIsRoot(): void
    {
        $config = getConfig();

        $this->assertSame('/', $config['cookie_path']);
    }

    public function testSessionLifetimeIsPositive(): void
    {
        $config = getConfig();

        $this->assertGreaterThan(0, $config['session_lifetime_seconds']);
    }

    public function testTaxeRateIsNumeric(): void
    {
        $config = getConfig();

        $this->assertIsNumeric($config['taxe_rate']);
    }

    public function testVersionFollowsSemver(): void
    {
        $config = getConfig();

        $this->assertMatchesRegularExpression(
            '/^\d+\.\d+\.\d+$/',
            $config['version']
        );
    }

    public function testDbDsnStartsWithPgsql(): void
    {
        $config = getConfig();

        $this->assertStringStartsWith('pgsql:', $config['db_dsn']);
    }

    // ── generateToken ─────────────────────────────────────────────

    public function testGenerateTokenReturnsHexString(): void
    {
        $token = generateToken();

        $this->assertMatchesRegularExpression('/^[a-f0-9]+$/', $token);
    }

    public function testGenerateTokenDefaultLength(): void
    {
        $token = generateToken();

        // Default length=64, bin2hex(random_bytes(32)) = 64 chars
        $this->assertSame(64, strlen($token));
    }

    public function testGenerateTokenCustomLength(): void
    {
        $token = generateToken(32);

        // 32/2 = 16 bytes => 32 hex chars
        $this->assertSame(32, strlen($token));
    }

    public function testGenerateTokenProducesUniqueValues(): void
    {
        $token1 = generateToken();
        $token2 = generateToken();

        $this->assertNotSame($token1, $token2);
    }

    // ── loadEnv ───────────────────────────────────────────────────

    public function testLoadEnvWithNonExistentFileDoesNotError(): void
    {
        // Should silently return without errors
        loadEnv('/nonexistent/path/.env');

        $this->assertTrue(true); // If we get here, no exception was thrown
    }

    public function testLoadEnvParsesValidFile(): void
    {
        $tmpFile = tempnam(sys_get_temp_dir(), 'env_test_');
        file_put_contents($tmpFile, "TEST_LOAD_ENV_VAR=hello_world\n");

        // Clear existing value if any
        putenv('TEST_LOAD_ENV_VAR');

        loadEnv($tmpFile);

        $this->assertSame('hello_world', getenv('TEST_LOAD_ENV_VAR'));

        // Cleanup
        putenv('TEST_LOAD_ENV_VAR');
        unlink($tmpFile);
    }

    public function testLoadEnvSkipsComments(): void
    {
        $tmpFile = tempnam(sys_get_temp_dir(), 'env_test_');
        file_put_contents($tmpFile, "# This is a comment\nTEST_ENV_COMMENT=value\n");

        putenv('TEST_ENV_COMMENT');

        loadEnv($tmpFile);

        $this->assertSame('value', getenv('TEST_ENV_COMMENT'));

        putenv('TEST_ENV_COMMENT');
        unlink($tmpFile);
    }

    public function testLoadEnvSkipsMalformedLines(): void
    {
        $tmpFile = tempnam(sys_get_temp_dir(), 'env_test_');
        file_put_contents($tmpFile, "NOEQUALSSIGN\nTEST_ENV_VALID=works\n");

        putenv('TEST_ENV_VALID');

        loadEnv($tmpFile);

        $this->assertSame('works', getenv('TEST_ENV_VALID'));

        putenv('TEST_ENV_VALID');
        unlink($tmpFile);
    }

    public function testLoadEnvDoesNotOverrideExistingVars(): void
    {
        $tmpFile = tempnam(sys_get_temp_dir(), 'env_test_');
        file_put_contents($tmpFile, "TEST_EXISTING=new_value\n");

        putenv('TEST_EXISTING=original_value');

        loadEnv($tmpFile);

        $this->assertSame('original_value', getenv('TEST_EXISTING'));

        putenv('TEST_EXISTING');
        unlink($tmpFile);
    }
}
