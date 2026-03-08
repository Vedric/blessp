<?php


function jsonResponse($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function getPDO($C) {
    static $pdo = null;
    if ($pdo) return $pdo;
    $pdo = new PDO($C['db_dsn'], $C['db_user'], $C['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    return $pdo;
}

function getJsonInput() {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function generateToken($length = 64) {
    return bin2hex(random_bytes($length/2));
}

// Authentication: read session token from cookie and validate
function getAuthenticatedUser($C) {
    if (empty($_COOKIE[$C['cookie_name']])) return null;
    $token = $_COOKIE[$C['cookie_name']];
    $pdo = getPDO($C);
    $stmt = $pdo->prepare("SELECT s.user_id, u.email, u.id as id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = :token AND s.expires_at > NOW() LIMIT 1");
    $stmt->execute([':token' => $token]);
    $user = $stmt->fetch();
    return $user ?: null;
}

function setSessionCookie($C, $token) {
    // setcookie signature: name, value, expires, path, domain, secure, httponly
    $expires = time() + $C['session_lifetime_seconds'];
    // PHP 7.3+ supports options array
    setcookie($C['cookie_name'], $token, [
        'expires' => $expires,
        'path' => $C['cookie_path'],
        'secure' => $C['cookie_secure'],
        'httponly' => $C['cookie_httponly'],
        'samesite' => $C['cookie_samesite'],
    ]);
}

function clearSessionCookie($C) {
    $expires = time() - 3600;
    setcookie($C['cookie_name'], '',[
        'expires' => $expires,
        'path' => $C['cookie_path'],
        'secure' => $C['cookie_secure'],
        'httponly' => $C['cookie_httponly'],
        'samesite' => $C['cookie_samesite'],
    ]);
}

?>