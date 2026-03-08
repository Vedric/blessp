<?php
include "../config.php";

include "./helper.php";

include "./address_fctn.php";

// Enforce CSRF on all POST requests
if ($method === 'POST') {
    csrfProtect();
}

try{

    if($method === 'POST' && $path === '/add'){
        addAddress($CONFIG);
        
        jsonResponse(['ok' => 'Address created']);
    }
    
    if($method == 'POST' && $path == '/save'){
        saveAddress($CONFIG);        
        
        jsonResponse(['ok' => 'Address saved']);
    }
    
    if($method == 'GET' && $path == '/delete'){
        deleteAddress($CONFIG);
        
        jsonResponse(['ok' => 'Address deleted']);
    }
    
    if($method == 'GET' && $path == '/user_addresses'){
        $addresses = getUserAddresses($CONFIG);
        
        jsonResponse(['addresses'=> $addresses]);
    }
    
    if($method == 'GET' && $path == '/address'){
        $address = getUserAddress($CONFIG);
        
        jsonResponse(['address'=> $address]);
    }
    
    jsonResponse(['error' => 'not_found', 'message' => 'Route not found: ' . $path], 404);

} catch (Exception $e) {
    error_log('Unhandled exception: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    jsonResponse(['error' => 'server_error', 'message' => 'An unexpected error occurred.'], 500);
}

?>