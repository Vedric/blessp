<?php
include "../config.php";

include "./helper.php";

include "./address_fctn.php";

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
    
    jsonResponse(['V1.0.0 > error' => $path.' not found, Script name : '.$scriptName], 404);
    
} catch (Exception $e) {
    // in production don't leak exception messages
    jsonResponse(['error' => 'server_error', 'message' => $e->getMessage()], 500);
}

?>