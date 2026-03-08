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
    // Batch-fetch all referenced products in a single query
    $productIds = [];
    foreach ($items as $item) {
        $productIds[(int)substr($item['product_key'], 0, 5)] = true;
    }
    $products = [];
    if (!empty($productIds)) {
        $ph = implode(',', array_fill(0, count($productIds), '?'));
        $stmt = $pdo->prepare("SELECT * FROM products WHERE id IN ({$ph})");
        $stmt->execute(array_keys($productIds));
        foreach ($stmt->fetchAll() as $p) {
            $products[(int)$p['id']] = $p;
        }
    }

    $orderItems = [];
    foreach ($items as $item) {
        $productKey = $item['product_key'];
        $product = $products[(int)substr($productKey, 0, 5)] ?? null;
        if (!$product) continue;

        $orderItem = new OrderItem(
            $product['name'],
            $productKey,
            str_replace("0", "", substr($productKey, 5, 3)),
            substr($productKey, 8, 3),
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
    $pg = getPaginationParams();
    $status = 'PAYED';

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM orders WHERE status = :status');
    $stmt->execute([':status' => $status]);
    $total = (int)$stmt->fetchColumn();

    $stmt = $pdo->prepare('SELECT * FROM orders WHERE status = :status ORDER BY id LIMIT :limit OFFSET :offset');
    $stmt->bindValue(':status', $status);
    $stmt->bindValue(':limit', $pg['perPage'], PDO::PARAM_INT);
    $stmt->bindValue(':offset', $pg['offset'], PDO::PARAM_INT);
    $stmt->execute();
    $orders = $stmt->fetchAll();

    paginatedResponse($orders, $total, $pg);
}

function getUserOrders($CONFIG){
    $user = getAuthenticatedUser($CONFIG);
    if (!$user) jsonResponse(['error' => 'unauthenticated'], 401);
    $userId = $user['id'];
    $pdo = getPDO($CONFIG);
    $pg = getPaginationParams();

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM orders WHERE user_id = :user_id');
    $stmt->execute([':user_id' => $userId]);
    $total = (int)$stmt->fetchColumn();

    $stmt = $pdo->prepare('SELECT * FROM orders WHERE user_id = :user_id ORDER BY id LIMIT :limit OFFSET :offset');
    $stmt->bindValue(':user_id', $userId);
    $stmt->bindValue(':limit', $pg['perPage'], PDO::PARAM_INT);
    $stmt->bindValue(':offset', $pg['offset'], PDO::PARAM_INT);
    $stmt->execute();
    $orders = $stmt->fetchAll();
    $userOrders = [];
    $customer = ['firstname' => $user['firstname'], 'lastname' => $user['lastname']];

    // Batch-fetch all order items for the current page of orders
    $orderIds = array_column($orders, 'id');
    $allItems = [];
    if (!empty($orderIds)) {
        $ph = implode(',', array_fill(0, count($orderIds), '?'));
        $stmt = $pdo->prepare("SELECT * FROM order_items WHERE order_id IN ({$ph})");
        $stmt->execute($orderIds);
        $allItems = $stmt->fetchAll();
    }

    // Batch-fetch all referenced products
    $productIds = [];
    foreach ($allItems as $item) {
        $productIds[(int)substr($item['product_key'], 0, 5)] = true;
    }
    $products = [];
    if (!empty($productIds)) {
        $ph = implode(',', array_fill(0, count($productIds), '?'));
        $stmt = $pdo->prepare("SELECT * FROM products WHERE id IN ({$ph})");
        $stmt->execute(array_keys($productIds));
        foreach ($stmt->fetchAll() as $p) {
            $products[(int)$p['id']] = $p;
        }
    }

    // Group items by order_id for efficient lookup
    $itemsByOrder = [];
    foreach ($allItems as $item) {
        $itemsByOrder[(int)$item['order_id']][] = $item;
    }

    foreach ($orders as $orderInfos) {
        $orderItems = [];
        foreach ($itemsByOrder[(int)$orderInfos['id']] ?? [] as $item) {
            $productKey = $item['product_key'];
            $product = $products[(int)substr($productKey, 0, 5)] ?? null;
            if (!$product) continue;

            $orderItem = new OrderItem(
                $product['name'],
                $productKey,
                str_replace("0", "", substr($productKey, 5, 3)),
                substr($productKey, 8, 3),
                $item['quantity'],
                $item['unit_price_cents'],
                $product['picture']
            );
            $orderItems[] = $orderItem;
        }

        $order = new Order($orderInfos, $customer, $orderItems);
        $userOrders[] = $order;
    }
    paginatedResponse($userOrders, $total, $pg);
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

    // Batch-fetch all product prices in a single query
    $items = $data['items'] ?? [];
    $validItems = [];
    $productIds = [];
    foreach ($items as $item) {
        if (isset($item['product'], $item['quantity'])) {
            $productIds[(int)substr($item['product'], 0, 5)] = true;
            $validItems[] = $item;
        }
    }
    $productPrices = [];
    if (!empty($productIds)) {
        $ph = implode(',', array_fill(0, count($productIds), '?'));
        $stmt = $pdo->prepare("SELECT id, price FROM products WHERE id IN ({$ph})");
        $stmt->execute(array_keys($productIds));
        foreach ($stmt->fetchAll() as $p) {
            $productPrices[(int)$p['id']] = $p['price'];
        }
    }

    $insertStmt = $pdo->prepare('INSERT INTO order_items(order_id, product_key, quantity, unit_price_cents) VALUES (:order_id, :product_key, :quantity, :price)');
    foreach ($validItems as $item) {
        $productKey = $item['product'];
        $price = $productPrices[(int)substr($productKey, 0, 5)] ?? null;
        if ($price === null) continue;

        $insertStmt->execute([':order_id' => $orderId, ':product_key' => $productKey, ':quantity' => $item['quantity'], ':price' => $price]);
    }

    jsonResponse(['ok' => true, 'order_id' => (int)$orderId, 'user'=>$user]);
}

?>
