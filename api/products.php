<?php
include "../config.php";

include "./helper.php";

include "./products_fctn.php";
include_once __DIR__ . "/../logger.php";


try{


    if($method==='GET' && $path === '/products'){
        getProducts($CONFIG);
    }
    
    if($method==='GET' && $path === '/active_products'){
        getActiveProducts($CONFIG);
    }
    
    if($method==='GET' && $path === '/product'){
        getProduct($CONFIG);
    }
    
    if($method==='GET' && $path === '/product_min'){
        getProductMin($CONFIG);
    }
    
    if($method==='GET' && $path === '/on_front'){
        getOnFrontProducts($CONFIG);
    }
    
    jsonResponse(['error' => 'not_found', 'message' => 'Route not found: ' . $path], 404);

} catch (Exception $e) {
    logError('Unhandled exception', ['exception' => $e->getMessage(), 'file' => $e->getFile(), 'line' => $e->getLine()]);
    jsonResponse(['error' => 'server_error', 'message' => 'An unexpected error occurred.'], 500);
}

?>