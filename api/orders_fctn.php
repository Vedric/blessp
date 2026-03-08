<?php

use Shop\Order;
use Shop\OrderItem;
include 'order.php';
include 'order_item.php';

function getOrder($CONFIG){
    $order_num = $_GET['order_num'] ?? null;
    if (!$order_num) jsonResponse(['error' => 'order_num is required'], 400);

    $pdo = getPDO($CONFIG);
    $stmt = $pdo->prepare('SELECT * FROM orders WHERE id=:order_num;');
    $stmt->execute([':order_num' => $order_num]);
    $orderInfos = $stmt->fetch();

    if (!$orderInfos) jsonResponse(['error' => 'order not found'], 404);

    $stmt = $pdo->prepare('SELECT firstname, lastname FROM users WHERE id=:userId');
    $stmt->execute([':userId'=>$orderInfos['user_id']]);
    $customer = $stmt->fetch();

    if (!$customer) jsonResponse(['error' => 'customer not found'], 404);

    $stmt = $pdo->prepare('SELECT * FROM order_items WHERE order_id = :order_num;');
    $stmt->execute([':order_num' => $order_num]);
    $items = $stmt->fetchAll();
    $orderItems = [];
    foreach($items as $item){
        $productKey = $item['product_key'];
        $productId = (int)substr($productKey,0,5);

        $stmt = $pdo->prepare('SELECT * FROM products WHERE id = :productId;');
        $stmt->execute([':productId' => $productId]);
        $product = $stmt->fetch();

        if (!$product) continue;

        $orderItem = new OrderItem(
            $product['name'],
            $productKey,
            str_replace("0","",substr($productKey,5,3)),
            substr($productKey,8,3),
            $item['quantity'],
            $item['unit_price_cents'],
            $product['picture']
        );
        $orderItems[] = $orderItem;
    }

    $order = new Order($orderInfos, $customer, $orderItems);
    jsonResponse($order);
}

function getOrders($CONFIG){
    $user = getAuthenticatedUser($CONFIG);
    if (!$user || !$user['admin']) jsonResponse(['error' => 'unauthenticated'], 401);
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
    $stmt->execute([':user_id'=>$userId]);
    $orders = $stmt->fetchAll();
    $userOrders = [];

    $customer = ['firstname' => $user['firstname'], 'lastname' => $user['lastname']];

    foreach($orders as $orderInfos){
        $stmt = $pdo->prepare('SELECT * FROM order_items WHERE order_id = :order_num;');
        $stmt->execute([':order_num' => $orderInfos['id']]);
        $items = $stmt->fetchAll();
        $orderItems = [];
        foreach($items as $item){
            $productKey = $item['product_key'];
            $productId = (int)substr($productKey,0,5);

            $stmt = $pdo->prepare('SELECT * FROM products WHERE id = :productId;');
            $stmt->execute([':productId' => $productId]);
            $product = $stmt->fetch();

            if (!$product) continue;

            $orderItem = new OrderItem(
                $product['name'],
                $productKey,
                str_replace("0","",substr($productKey,5,3)),
                substr($productKey,8,3),
                $item['quantity'],
                $item['unit_price_cents'],
                $product['picture']
            );
            $orderItems[] = $orderItem;
        }

        $order = new Order($orderInfos, $customer, $orderItems);
        $userOrders[] = $order;
    }
    jsonResponse($userOrders);
}

function savePayedOrder($CONFIG){
    $user = getAuthenticatedUser($CONFIG);

    if (!$user) jsonResponse(['error' => 'unauthenticated'], 401);

    $userId = $user['id'];

    $pdo = getPDO($CONFIG);

    $data = getJsonInput();

    if (empty($data)) {
        jsonResponse(['error' => 'invalid request body'], 400);
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
            $data['account_address']['country'])){

                $firstname = $data['account_address']['firstname'];
                $lastname = $data['account_address']['lastname'];
                $address = $data['account_address']['address'];
                $city = $data['account_address']['city'];
                $postalCode = $data['account_address']['postalcode'];
                $phone = $data['account_address']['phone'];
                $country = $data['account_address']['country'];

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

    $items = $data['items'] ?? [];
    foreach ($items as $item) {
        if (isset($item['product'], $item['quantity'])) {
            $productKey = $item['product'];
            $productId = (int)substr($productKey,0,5);
            $stmt = $pdo->prepare('SELECT price FROM products WHERE id = :productId');
            $stmt->execute([':productId' => $productId]);
            $productPrice = $stmt->fetch();

            if (!$productPrice) continue;

            $stmt = $pdo->prepare('INSERT INTO order_items(order_id, product_key, quantity, unit_price_cents) VALUES (:order_id, :product_key, :quantity, :price)');
            $stmt->execute([':order_id' => $orderId, ':product_key' => $item['product'], ':quantity' => $item['quantity'], ':price' => $productPrice['price']]);
        }
    }

    jsonResponse(['ok' => true, 'order_id' => (int)$orderId, 'user'=>$user]);
}

?>
