<?php
    $config = getConfig();

    function getPDO($C) {
        static $pdo = null;
        if ($pdo) return $pdo;
        $pdo = new PDO($C['db_dsn'], $C['db_user'], $C['db_pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        return $pdo;
    }

    function getAuthenticatedUser($C) {
        if (empty($_COOKIE["session_token"])) return null;
        $token = $_COOKIE["session_token"];
        $pdo = getPDO($C);
        $stmt = $pdo->prepare("SELECT s.user_id, u.email, u.id as id, u.firstname, u.lastname, u.admin FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = :token AND s.expires_at > NOW() LIMIT 1");
        $stmt->execute([':token' => $token]);
        $user = $stmt->fetch();
        return $user;
    }

?>