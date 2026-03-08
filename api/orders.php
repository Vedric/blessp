<?php
include "../config.php";

include "./helper.php";

include "./orders_fctn.php";

// Enforce CSRF on all POST requests
if ($method === 'POST') {
    csrfProtect();
}

try{

    if($method == 'GET' && $path == '/orders'){
        getOrders($CONFIG);
    }
    
    if($method == 'GET' && $path == '/user_orders'){
        getUserOrders($CONFIG);
    }
    
    if($method == 'GET' && $path == '/order'){
        getOrder($CONFIG);
    }
    
    if($method == 'POST' && $path == '/save_payed_order'){
        savePayedOrder($CONFIG);
    }
    
    jsonResponse(['error' => 'not_found', 'message' => 'Route not found: ' . $path], 404);

} catch (Exception $e) {
    error_log('Unhandled exception: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    jsonResponse(['error' => 'server_error', 'message' => 'An unexpected error occurred.'], 500);
}
?>
