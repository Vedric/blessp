<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/Integration/DatabaseTestCase.php';

/**
 * Base class for E2E API tests.
 *
 * Starts PHP's built-in web server on a random port and sends real HTTP
 * requests through curl. The test database is set up the same way as
 * integration tests.
 */
abstract class ApiTestCase extends DatabaseTestCase
{
    private static string $serverHost = '127.0.0.1';
    private static int $serverPort = 0;
    /** @var resource|null */
    private static $serverProcess = null;

    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();

        // Pick a random available port
        $sock = socket_create(AF_INET, SOCK_STREAM, SOL_TCP);
        socket_bind($sock, '127.0.0.1', 0);
        socket_getsockname($sock, $addr, $port);
        socket_close($sock);
        self::$serverPort = $port;

        $docRoot = PROJECT_ROOT;
        $dsn  = getenv('DB_DSN')  ?: 'pgsql:host=127.0.0.1;port=5432;dbname=blessp_test';
        $user = getenv('DB_USER') ?: 'postgres';
        $pass = getenv('DB_PASS') ?: 'postgres';

        $cmd = sprintf(
            'DB_DSN=%s DB_USER=%s DB_PASS=%s php -S %s:%d -t %s > /dev/null 2>&1 & echo $!',
            escapeshellarg($dsn),
            escapeshellarg($user),
            escapeshellarg($pass),
            self::$serverHost,
            self::$serverPort,
            escapeshellarg($docRoot)
        );

        $pid = (int) trim(shell_exec($cmd));
        if ($pid <= 0) {
            self::markTestSkipped('Could not start PHP built-in server.');
        }

        self::$serverProcess = $pid;

        // Wait for server to be ready (max 3 seconds)
        $deadline = time() + 3;
        while (time() < $deadline) {
            $conn = @fsockopen(self::$serverHost, self::$serverPort, $errno, $errstr, 0.1);
            if ($conn) {
                fclose($conn);
                return;
            }
            usleep(50000);
        }

        self::markTestSkipped('PHP built-in server did not start in time.');
    }

    public static function tearDownAfterClass(): void
    {
        if (self::$serverProcess) {
            posix_kill(self::$serverProcess, SIGTERM);
            self::$serverProcess = null;
        }
        parent::tearDownAfterClass();
    }

    /**
     * Send an HTTP request to the test server.
     *
     * @return array{status: int, body: mixed, headers: array<string, string>}
     */
    protected function request(
        string $method,
        string $path,
        ?array $body = null,
        array $headers = [],
        ?string $cookie = null,
    ): array {
        $url = sprintf('http://%s:%d%s', self::$serverHost, self::$serverPort, $path);

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HEADER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);

        $curlHeaders = ['Accept: application/json'];
        foreach ($headers as $key => $value) {
            $curlHeaders[] = "{$key}: {$value}";
        }

        if ($body !== null) {
            $json = json_encode($body);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
            $curlHeaders[] = 'Content-Type: application/json';
        }

        if ($cookie) {
            curl_setopt($ch, CURLOPT_COOKIE, $cookie);
        }

        curl_setopt($ch, CURLOPT_HTTPHEADER, $curlHeaders);

        $response = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        curl_close($ch);

        $rawHeaders = substr($response, 0, $headerSize);
        $rawBody = substr($response, $headerSize);

        $parsedHeaders = [];
        foreach (explode("\r\n", $rawHeaders) as $line) {
            if (strpos($line, ':') !== false) {
                [$key, $value] = explode(':', $line, 2);
                $parsedHeaders[strtolower(trim($key))] = trim($value);
            }
        }

        $decoded = json_decode($rawBody, true);

        return [
            'status' => $httpCode,
            'body' => $decoded ?? $rawBody,
            'headers' => $parsedHeaders,
        ];
    }

    /**
     * Register a user and return the response.
     */
    protected function registerUser(
        string $email = 'e2e@test.com',
        string $password = 'TestPass123',
        string $firstname = 'E2E',
        string $lastname = 'Tester',
    ): array {
        return $this->request('POST', '/api.php/register', [
            'email' => $email,
            'password' => $password,
            'firstname' => $firstname,
            'lastname' => $lastname,
        ]);
    }
}
