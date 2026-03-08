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

if (!function_exists('getPaginationParams')) {
    function getPaginationParams(): array {
        $page = max(1, (int)($_GET['page'] ?? 1));
        $perPage = min(100, max(1, (int)($_GET['perPage'] ?? 20)));
        $offset = ($page - 1) * $perPage;
        return ['page' => $page, 'perPage' => $perPage, 'offset' => $offset];
    }
}

if (!function_exists('paginatedResponse')) {
    function paginatedResponse(array $data, int $totalItems, array $pagination): void {
        $totalPages = (int)ceil($totalItems / $pagination['perPage']);
        jsonResponse([
            'data' => $data,
            'pagination' => [
                'page' => $pagination['page'],
                'perPage' => $pagination['perPage'],
                'totalItems' => $totalItems,
                'totalPages' => $totalPages,
            ]
        ]);
    }
}

?>
