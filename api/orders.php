<?php
include "../config.php";

include "./helper.php";

include "./orders_fctn.php";

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
    
    jsonResponse(['V1.0.0 > error' => $path.' not found, Script name : '.$scriptName], 404);
    
} catch (Exception $e) {
    // in production don't leak exception messages
    jsonResponse(['error' => 'server_error', 'message' => $e->getMessage()], 500);
}
?>
