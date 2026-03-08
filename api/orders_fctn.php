<?php

use Shop\Order;
use Shop\OrderItem;
include 'order.php';
include 'order_item.php';

function getOrder($CONFIG){
    $order_num=$_GET['order_num'];
    $pdo = getPDO($CONFIG);
    $stmt = $pdo->prepare('SELECT * FROM orders WHERE id=:order_num;');
    $stmt->execute([':order_num' => $order_num]);
    $fetchOrderResults = $stmt->fetchAll();
    
    $orderInfos = $fetchOrderResults[0];
    
    $stmt = $pdo->prepare('SELECT firstname, lastname FROM users WHERE id=:userId');
    $stmt->execute([':userId'=>$orderInfos['user_id']]);
    $fetchCustomerResults = $stmt->fetchAll();
    
    $customer = $fetchCustomerResults[0];
    
    
    $stmt = $pdo->prepare('SELECT * FROM order_items WHERE order_id = :order_num;');
    $stmt->execute([':order_num' => $order_num]);
    $items = $stmt->fetchAll();
    $orderItems = [];
    foreach($items as $item){
        
        $productKey = $item['product_key'];
        $productId = (int)substr($productKey,0,5);
        
        $stmt = $pdo->prepare('SELECT * FROM products WHERE id = :productId;');
        $stmt->execute([':productId' => $productId]);
        $product = $stmt->fetchAll();
        
        
        $articleName = $product[0]['name'];
        $articleCode = $productKey;
        $articleSize = str_replace("0","",substr($productKey,5,3));
        $articleColor = substr($productKey,8,3);
        $qty = $item['quantity'];
        $unitPrice = $item['unit_price_cents'];
        $picture = $product[0]['picture'];
        
        
        $orderItem = new OrderItem($articleName, $articleCode, $articleSize, $articleColor, $qty, $unitPrice, $picture);
        $orderItems[]= $orderItem;
        
    }
    
    $order = new Order($orderInfos, $customer, $orderItems);
    
    jsonResponse($order);
    
}

function getOrders($CONFIG){
    $user = getAuthenticatedUser($CONFIG);
    if (!$user && !$user['admin']) jsonResponse(['error' => 'unauthenticated'], 401);
    $pdo = getPDO($CONFIG);
    $status = 'PAYED';
    $stmt = $pdo->prepare('SELECT * FROM orders WHERE status = :status ORDER BY id;');
    $stmt->execute([':status' => $status]);
    $orders = $stmt->fetchAll();
    jsonResponse($orders);
}

function getUserOrders($CONFIG){
    $user = getAuthenticatedUser($CONFIG);
    if (!$user) jsonResponse(['error' => 'unauthenticated'], 401);
    $userId = $user['id'];
    $pdo = getPDO($CONFIG);
    $stmt = $pdo->prepare('SELECT * FROM orders WHERE user_id = :user_id ORDER BY id;');
    $stmt->execute(['user_id'=>$userId]);
    $orders = $stmt->fetchAll();
    $userOrders = [];
    foreach($orders as $orderInfos){
        
        $stmt = $pdo->prepare('SELECT firstname, lastname FROM users WHERE id=:userId');
        $stmt->execute([':userId'=>$orderInfos['user_id']]);
        $fetchCustomerResults = $stmt->fetchAll();
        
        $customer = $fetchCustomerResults[0];
        
//         $stmt = $pdo->prepare('SELECT * FROM account_addresses WHERE id=:addressId');
//         $stmt->execute([':addressId'=>$orderInfos['shipping_address_id']]);
//         $fetchAddressResults = $stmt->fetchAll();
        
//         $shippingAddress = $fetchAddressResults[0];
        
        $stmt = $pdo->prepare('SELECT * FROM order_items WHERE order_id = :order_num;');
        $stmt->execute([':order_num' => $orderInfos['id']]);
        $items = $stmt->fetchAll();
        $orderItems = [];
        foreach($items as $item){
            
            $productKey = $item['product_key'];
            $productId = (int)substr($productKey,0,5);
            
            $stmt = $pdo->prepare('SELECT * FROM products WHERE id = :productId;');
            $stmt->execute([':productId' => $productId]);
            $product = $stmt->fetchAll();
            
            $articleName = $product[0]['name'];
            $articleCode = $productKey;
            $articleSize = str_replace("0","",substr($productKey,5,3));
            $articleColor = substr($productKey,8,3);
            $qty = $item['quantity'];
            $unitPrice = $item['unit_price_cents'];
            $picture = $product[0]['picture'];
            
            $orderItem = new OrderItem($articleName, $articleCode, $articleSize, $articleColor, $qty, $unitPrice, $picture);
            $orderItems[]= $orderItem;
        }
        
        $order = new Order($orderInfos, $customer, $orderItems);
        $userOrders[] = $order;
    }
    jsonResponse($userOrders);
}

function savePayedOrder($CONFIG){
    $user = getAuthenticatedUser($CONFIG);
    
    if (!$user) jsonResponse(['error' => 'unauthenticated'], 401);
    
    if($user) $userId = $user['id'];
    
    $pdo = getPDO($CONFIG);
    
    $raw = file_get_contents('php://input');
    
    $data = getJsonInput();
    
    // Vérification d'erreurs de décodage
    if (json_last_error() !== JSON_ERROR_NONE) {
        jsonResponse("Erreur JSON : " . json_last_error_msg());
    }
    
    // Vérification que c'est bien un tableau
    if (!is_array($data)) {
        jsonResponse("Le JSON décodé n'est pas un tableau.");
    }
    $shippingAddressId = null;
    if(isset($data['account_address']['id'])){
        $shippingAddressId = $data['account_address']['id'];
    }else{
        if(isset($data['account_address'],
            $data['account_address']['address'],
            $data['account_address']['city'],
            $data['account_address']['postalcode'],
            $data['account_address']['phone'],
            $data['account_address']['country'],
            $data['account_address']['note'])){
                
                
                $firstname = $data['account_address']['firstname'];
                $lastname = $data['account_address']['lastname'];
                $address = $data['account_address']['address'];
                $city = $data['account_address']['city'];
                $postalCode = $data['account_address']['postalcode'];
                $phone = $data['account_address']['phone'];
                $country = $data['account_address']['country'];
                $note = $data['account_address']['note'];
                
                $stmt = $pdo->prepare('INSERT INTO account_addresses(user_id, firstname, lastname, phonenumber, address, city, postal_code, country, address_type, default_address) VALUES (:user_id, :firstname, :lastname, :phone, :address, :city, :postal_code, :country, :address_type, true)');
                $stmt->execute([':user_id' => $userId, ':firstname' => $firstname, ':lastname' => $lastname, ':phone' => $phone, ':address' => $address, ':city' => $city, ':postal_code' => $postalCode, ':country' => $country, ':address_type' => 1]);
                $shippingAddressId = $pdo->lastInsertId();
        }
    }
    
    
    
    $stmt = $pdo->prepare('SELECT * FROM account_addresses WHERE id=:addressId;');
    $stmt->execute([':addressId' => $shippingAddressId]);
    $shippingAddress = $stmt->fetch();
    $shippingAddressStr = json_encode($shippingAddress, JSON_UNESCAPED_UNICODE);
    
    $amount = (float)$data['orderAmount'];
    $transactionKey = $data['transaction_key'];
    $stmt = $pdo->prepare('INSERT INTO orders(user_id, amount, status, transaction_key, shipping_address) VALUES (:user_id, :amount, :status, :transaction_key, :shipping_address)');
    $stmt->execute([':user_id' => $userId, ':amount' => $amount, ':status' => 'PAYED', ':transaction_key' => $transactionKey, ':shipping_address' => $shippingAddressStr]);
    
    $orderId = $pdo->lastInsertId();
    
    // Parcours du tableau
    $items = $data['items'];
    foreach ($items as $item) {
        // Validation des clés attendues
        if (isset($item['product'], $item['quantity'])) {
            $productKey = $item['product'];
            $productId = (int)substr($productKey,0,5);
            $stmt = $pdo->prepare('SELECT price FROM products WHERE id = :productId');
            $stmt->execute([':productId' => $productId]);
            $productPrice = $stmt->fetchAll();
            
            $stmt = $pdo->prepare('INSERT INTO order_items(order_id, product_key, quantity, unit_price_cents) VALUES (:order_id, :product_key, :quantity, :price)');
            $stmt->execute([':order_id' => $orderId, ':product_key' => $item['product'], ':quantity' => $item['quantity'], ':price' => $productPrice[0]['price']]);
        } else {
            echo "Élément incomplet ou invalide.\n";
        }
    }
    
    jsonResponse(['ok' => true, 'order_id' => (int)$orderId, 'data' => $raw, 'user'=>$user]);
    //jsonResponse(['data'=> $data]);
}


?>