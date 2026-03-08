<?php

$CONFIG = getConfig();
include_once __DIR__ . '/../authent.php';
include_once __DIR__ . '/../csrf.php';

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$scriptName = dirname($_SERVER['SCRIPT_NAME']);
$idx = strrpos($path, "/");
$end = strlen($path);
if (str_contains($path, '?')) {
    $end = strpos($path, '?');
}
$path = substr($path, 0, $end);
$path = substr($path, $idx);
if ($scriptName !== '/' && strpos($path, $scriptName) === 0) {
    $path = substr($path, strlen($scriptName));
}
$path = '/' . trim($path, '/');

if (!function_exists('jsonResponse')) {
    function jsonResponse($data, $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }
}

if (!function_exists('getJsonInput')) {
    function getJsonInput() {
        $raw = file_get_contents('php://input');
        if (!$raw) return [];
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }
}

?>
