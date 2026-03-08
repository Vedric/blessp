<?php
include "../config.php";

include "./helper.php";

include "./products_fctn.php";


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
    
    jsonResponse(['V1.0.0 > error' => $path.' not found, Script name : '.$scriptName], 404);

} catch (Exception $e) {
    // in production don't leak exception messages
    jsonResponse(['error' => 'server_error', 'message' => $e->getMessage()], 500);
}

?>