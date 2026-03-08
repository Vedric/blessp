<?php
/**
 * CSRF protection using the Synchronizer Token Pattern.
 *
 * Generates a per-session token stored in $_SESSION and validates it
 * against the X-CSRF-Token header (for AJAX) or a hidden form field.
 */

function csrfStartSession(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
}

function csrfGenerateToken(): string {
    csrfStartSession();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrfGetToken(): string {
    csrfStartSession();
    return $_SESSION['csrf_token'] ?? csrfGenerateToken();
}

function csrfValidateToken(?string $token): bool {
    csrfStartSession();
    if (empty($_SESSION['csrf_token']) || empty($token)) {
        return false;
    }
    return hash_equals($_SESSION['csrf_token'], $token);
}

/**
 * Enforce CSRF validation on the current request.
 * Checks the X-CSRF-Token header first, then falls back to a _csrf_token POST field.
 * Responds with 403 and exits if the token is missing or invalid.
 */
function csrfProtect(): void {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['_csrf_token'] ?? null;
    if (!csrfValidateToken($token)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'csrf_error', 'message' => 'Invalid or missing CSRF token.']);
        exit;
    }
}

/**
 * Output a <meta> tag with the CSRF token for use by frontend JS.
 */
function csrfMetaTag(): string {
    $token = csrfGetToken();
    return '<meta name="csrf-token" content="' . htmlspecialchars($token, ENT_QUOTES, 'UTF-8') . '">';
}
?>
