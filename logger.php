<?php
/**
 * Structured JSON logger with log levels, request ID tracking,
 * and sensitive data redaction.
 */

if (!defined('BLESSP_LOG_LEVEL_DEBUG')) {
    define('BLESSP_LOG_LEVEL_DEBUG', 0);
    define('BLESSP_LOG_LEVEL_INFO', 1);
    define('BLESSP_LOG_LEVEL_WARN', 2);
    define('BLESSP_LOG_LEVEL_ERROR', 3);
}

/**
 * Resolve the configured minimum log level from the LOG_LEVEL
 * environment variable. The result is cached for the lifetime
 * of the request.
 */
function loggerGetLevel(): int {
    static $level = null;
    if ($level === null) {
        $level = match (strtolower(getenv('LOG_LEVEL') ?: 'info')) {
            'debug' => BLESSP_LOG_LEVEL_DEBUG,
            'info'  => BLESSP_LOG_LEVEL_INFO,
            'warn', 'warning' => BLESSP_LOG_LEVEL_WARN,
            'error' => BLESSP_LOG_LEVEL_ERROR,
            default => BLESSP_LOG_LEVEL_INFO,
        };
    }
    return $level;
}

/**
 * Generate or retrieve a request ID that persists for
 * the lifetime of a single HTTP request. Prefers the
 * X-Request-ID header sent by a reverse proxy when available.
 */
function loggerRequestId(): string {
    static $requestId = null;
    if ($requestId === null) {
        $requestId = $_SERVER['HTTP_X_REQUEST_ID']
            ?? bin2hex(random_bytes(8));
    }
    return $requestId;
}

/**
 * Recursively redact sensitive values from a context array.
 */
function loggerRedact(array $context): array {
    static $redactKeys = [
        'password', 'password_hash', 'token', 'session_token',
        'authorization', 'cookie', 'csrf_token', 'secret',
        'api_key', 'credit_card', 'card_number',
    ];

    $result = [];
    foreach ($context as $key => $value) {
        if (in_array(strtolower((string)$key), $redactKeys, true)) {
            $result[$key] = '[REDACTED]';
        } elseif (is_array($value)) {
            $result[$key] = loggerRedact($value);
        } else {
            $result[$key] = $value;
        }
    }
    return $result;
}

/**
 * Write a structured JSON log entry to stderr so it does
 * not mix with HTTP response output.
 */
function loggerWrite(string $level, string $message, array $context = []): void {
    $levelMap = [
        'debug' => BLESSP_LOG_LEVEL_DEBUG,
        'info'  => BLESSP_LOG_LEVEL_INFO,
        'warn'  => BLESSP_LOG_LEVEL_WARN,
        'error' => BLESSP_LOG_LEVEL_ERROR,
    ];

    if (($levelMap[$level] ?? BLESSP_LOG_LEVEL_INFO) < loggerGetLevel()) {
        return;
    }

    $entry = [
        'timestamp' => gmdate('Y-m-d\TH:i:s\Z'),
        'level'     => $level,
        'message'   => $message,
        'requestId' => loggerRequestId(),
    ];

    if (!empty($context)) {
        $entry['context'] = loggerRedact($context);
    }

    if (isset($_SERVER['REQUEST_METHOD'])) {
        $entry['method'] = $_SERVER['REQUEST_METHOD'];
    }
    if (isset($_SERVER['REQUEST_URI'])) {
        $entry['path'] = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    }

    file_put_contents('php://stderr', json_encode($entry, JSON_UNESCAPED_UNICODE) . "\n");
}

function logDebug(string $message, array $context = []): void {
    loggerWrite('debug', $message, $context);
}

function logInfo(string $message, array $context = []): void {
    loggerWrite('info', $message, $context);
}

function logWarn(string $message, array $context = []): void {
    loggerWrite('warn', $message, $context);
}

function logError(string $message, array $context = []): void {
    loggerWrite('error', $message, $context);
}
