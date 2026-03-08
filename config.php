<?php
    function loadEnv($path = __DIR__ . '/.env') {
        if (!file_exists($path)) return;
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            if (str_starts_with(trim($line), '#')) continue;
            $parts = explode('=', $line, 2);
            if (count($parts) !== 2) continue;
            $key = trim($parts[0]);
            $value = trim($parts[1]);
            if (!getenv($key)) {
                putenv("$key=$value");
                $_ENV[$key] = $value;
            }
        }
    }

    loadEnv();

    function getConfig(){
        $config = [
            'db_dsn' => getenv('DB_DSN') ?: 'pgsql:host=127.0.0.1;port=5432;dbname=blessp',
            'db_user' => getenv('DB_USER') ?: 'postgres',
            'db_pass' => getenv('DB_PASS') ?: '',
            'cookie_name' => 'session_token',
            'session_lifetime_seconds' => 48 * 3600,
            'cookie_path' => '/',
            'cookie_secure' => filter_var(getenv('COOKIE_SECURE') ?: 'false', FILTER_VALIDATE_BOOLEAN),
            'cookie_httponly' => true,
            'cookie_samesite' => 'Strict',
            'version' => '1.0.6',
            'taxe_rate' => 0
        ];

        return $config;
    }
?>
