<?php
    $config = getConfig();

    if (!function_exists('getPDO')) {
        function getPDO($C) {
            static $pdo = null;
            if ($pdo) return $pdo;
            $pdo = new PDO($C['db_dsn'], $C['db_user'], $C['db_pass'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
            return $pdo;
        }
    }

    if (!function_exists('getAuthenticatedUser')) {
        function getAuthenticatedUser($C) {
            $cookieName = $C['cookie_name'] ?? 'session_token';
            if (empty($_COOKIE[$cookieName])) return null;
            $token = $_COOKIE[$cookieName];
            $pdo = getPDO($C);
            $stmt = $pdo->prepare("SELECT s.user_id, u.email, u.id as id, u.firstname, u.lastname, u.admin FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = :token AND s.expires_at > NOW() LIMIT 1");
            $stmt->execute([':token' => $token]);
            $user = $stmt->fetch();
            return $user ?: null;
        }
    }

?>