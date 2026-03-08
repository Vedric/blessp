<?php
/**
 * IP-based rate limiter using the filesystem.
 *
 * Stores attempt counts in temporary files under a dedicated directory.
 * Each file corresponds to one IP and contains the timestamps of recent
 * requests within the configured window. Expired entries are pruned on
 * every check.
 *
 * For a single-server deployment this is sufficient. In a multi-server
 * environment, replace this with a Redis-backed counter.
 */

function rateLimitCheck(string $action, int $maxAttempts, int $windowSeconds): bool {
    $storageDir = sys_get_temp_dir() . '/blessp_rate_limit';
    if (!is_dir($storageDir)) {
        mkdir($storageDir, 0700, true);
    }

    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    $safeKey = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $action . '_' . $ip);
    $filePath = $storageDir . '/' . $safeKey;

    $now = time();
    $windowStart = $now - $windowSeconds;

    // Read existing timestamps, filtering out expired entries
    $timestamps = [];
    if (file_exists($filePath)) {
        $raw = file_get_contents($filePath);
        if ($raw !== false) {
            $timestamps = array_filter(
                array_map('intval', explode("\n", trim($raw))),
                function (int $ts) use ($windowStart) {
                    return $ts >= $windowStart;
                }
            );
        }
    }

    if (count($timestamps) >= $maxAttempts) {
        // Calculate when the oldest entry in the window expires
        $oldestInWindow = min($timestamps);
        $retryAfter = ($oldestInWindow + $windowSeconds) - $now;
        if ($retryAfter < 1) $retryAfter = 1;

        header('Retry-After: ' . $retryAfter);
        http_response_code(429);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'error' => 'rate_limit_exceeded',
            'message' => 'Too many requests. Please wait before trying again.',
            'retry_after' => $retryAfter
        ]);
        exit;
    }

    // Record the current attempt
    $timestamps[] = $now;
    file_put_contents($filePath, implode("\n", $timestamps), LOCK_EX);

    return true;
}

/**
 * Track failed login attempts per account email for lockout detection.
 * Returns the number of failed attempts in the current window.
 */
function rateLimitLoginFailed(string $email, int $maxAttempts, int $windowSeconds): void {
    $storageDir = sys_get_temp_dir() . '/blessp_rate_limit';
    if (!is_dir($storageDir)) {
        mkdir($storageDir, 0700, true);
    }

    $safeKey = 'login_failed_' . preg_replace('/[^a-zA-Z0-9_\-]/', '_', $email);
    $filePath = $storageDir . '/' . $safeKey;

    $now = time();
    $windowStart = $now - $windowSeconds;

    $timestamps = [];
    if (file_exists($filePath)) {
        $raw = file_get_contents($filePath);
        if ($raw !== false) {
            $timestamps = array_filter(
                array_map('intval', explode("\n", trim($raw))),
                function (int $ts) use ($windowStart) {
                    return $ts >= $windowStart;
                }
            );
        }
    }

    $timestamps[] = $now;
    file_put_contents($filePath, implode("\n", $timestamps), LOCK_EX);
}

/**
 * Check if an account is locked out due to too many failed attempts.
 */
function rateLimitIsAccountLocked(string $email, int $maxAttempts, int $windowSeconds): bool {
    $storageDir = sys_get_temp_dir() . '/blessp_rate_limit';
    $safeKey = 'login_failed_' . preg_replace('/[^a-zA-Z0-9_\-]/', '_', $email);
    $filePath = $storageDir . '/' . $safeKey;

    if (!file_exists($filePath)) return false;

    $now = time();
    $windowStart = $now - $windowSeconds;

    $raw = file_get_contents($filePath);
    if ($raw === false) return false;

    $timestamps = array_filter(
        array_map('intval', explode("\n", trim($raw))),
        function (int $ts) use ($windowStart) {
            return $ts >= $windowStart;
        }
    );

    return count($timestamps) >= $maxAttempts;
}

/**
 * Clear failed login attempts (called on successful login).
 */
function rateLimitClearLoginFailed(string $email): void {
    $storageDir = sys_get_temp_dir() . '/blessp_rate_limit';
    $safeKey = 'login_failed_' . preg_replace('/[^a-zA-Z0-9_\-]/', '_', $email);
    $filePath = $storageDir . '/' . $safeKey;

    if (file_exists($filePath)) {
        unlink($filePath);
    }
}
?>
