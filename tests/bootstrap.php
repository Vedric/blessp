<?php
/**
 * PHPUnit test bootstrap.
 *
 * Loads project source files and sets up the test environment.
 * Functions guarded with function_exists() in production code are
 * loaded here once so tests can call them directly.
 */

// Prevent config.php from loading .env (tests use phpunit.xml env vars)
putenv('DB_DSN=' . ($_ENV['DB_DSN'] ?? 'pgsql:host=127.0.0.1;port=5432;dbname=blessp_test'));
putenv('DB_USER=' . ($_ENV['DB_USER'] ?? 'postgres'));
putenv('DB_PASS=' . ($_ENV['DB_PASS'] ?? 'postgres'));

define('PROJECT_ROOT', dirname(__DIR__));

// Load domain classes
require_once PROJECT_ROOT . '/order.php';
require_once PROJECT_ROOT . '/order_item.php';

// Load config (defines getConfig, loadEnv)
require_once PROJECT_ROOT . '/config.php';

// Load CSRF (defines csrf* functions, requires session)
require_once PROJECT_ROOT . '/csrf.php';

// Load rate limiting
require_once PROJECT_ROOT . '/rate_limit.php';

// Load api_helper (defines jsonResponse, getPDO, getJsonInput, generateToken, etc.)
require_once PROJECT_ROOT . '/api_helper.php';

// Load structured logger
require_once PROJECT_ROOT . '/logger.php';

// Load pagination helpers from api/helper.php
// These use function_exists() guards, so only new ones are defined
require_once PROJECT_ROOT . '/api/helper.php';
