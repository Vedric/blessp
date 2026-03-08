<?php
use Shop\Order;
use Shop\OrderItem;
include 'order.php';
include 'order_item.php';
include './config.php';
include_once './authent.php';

$CONFIG = getConfig();

// -----------------------------
// Rate limiting
// -----------------------------
include_once __DIR__ . '/rate_limit.php';

// -----------------------------
// CSRF protection
// -----------------------------
include_once __DIR__ . '/csrf.php';

// -----------------------------
// Structured logger
// -----------------------------
include_once __DIR__ . '/logger.php';

// -----------------------------
// Security headers
// -----------------------------
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 0');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');

// -----------------------------
// Helpers
// -----------------------------

function jsonResponse($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function getJsonInput() {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function generateToken($length = 64) {
    return bin2hex(random_bytes($length/2));
}

function getPaginationParams(): array {
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(100, max(1, (int)($_GET['perPage'] ?? 20)));
    $offset = ($page - 1) * $perPage;
    return ['page' => $page, 'perPage' => $perPage, 'offset' => $offset];
}

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

function setSessionCookie($C, $token) {
    // setcookie signature: name, value, expires, path, domain, secure, httponly
    $expires = time() + $C['session_lifetime_seconds'];
    // PHP 7.3+ supports options array
    setcookie($C['cookie_name'], $token, [
        'expires' => $expires,
        'path' => $C['cookie_path'],
        'secure' => $C['cookie_secure'],
        'httponly' => $C['cookie_httponly'],
        'samesite' => $C['cookie_samesite'],
    ]);
}

function clearSessionCookie($C) {
    $expires = time() - 3600;
    setcookie($C['cookie_name'], '',[
        'expires' => $expires,
        'path' => $C['cookie_path'],
        'secure' => $C['cookie_secure'],
        'httponly' => $C['cookie_httponly'],
        'samesite' => $C['cookie_samesite'],
    ]);
}

// -----------------------------
// Basic routing
// -----------------------------
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// remove script name prefix if present
$scriptName = dirname($_SERVER['SCRIPT_NAME']);
$idx = strrpos($path,"/");
$end = strlen($path);
if(str_contains($path,'?')){
    $end = strpos($path,'?');
}
$path = substr($path,0,$end);
$path = substr($path,$idx);
if ($scriptName !== '/' && strpos($path, $scriptName) === 0) {
    $path = substr($path, strlen($scriptName));
}
$path = '/' . trim($path, '/');

function register($CONFIG){
    // Rate limit: 5 registration attempts per IP per 15 minutes
    rateLimitCheck('register', 5, 900);

    $data = getJsonInput();
    $errors = [];

    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';
    $firstname = trim($data['firstname'] ?? '');
    $lastname = trim($data['lastname'] ?? '');

    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = 'A valid email address is required.';
    }
    if (mb_strlen($email) > 254) {
        $errors['email'] = 'Email must not exceed 254 characters.';
    }
    if (empty($password) || mb_strlen($password) < 8) {
        $errors['password'] = 'Password must be at least 8 characters.';
    }
    if (mb_strlen($password) > 128) {
        $errors['password'] = 'Password must not exceed 128 characters.';
    }
    if (empty($firstname) || mb_strlen($firstname) > 100) {
        $errors['firstname'] = 'First name is required (max 100 characters).';
    }
    if (empty($lastname) || mb_strlen($lastname) > 100) {
        $errors['lastname'] = 'Last name is required (max 100 characters).';
    }

    if (!empty($errors)) {
        jsonResponse(['error' => 'validation_error', 'fields' => $errors], 422);
    }

    $email = mb_strtolower($email);

    $pdo = getPDO($CONFIG);
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $stmt->execute([':email' => $email]);
    if ($stmt->fetch()) jsonResponse(['error' => 'email already used'], 409);

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('INSERT INTO users (email, password_hash, created_at, firstname, lastname) VALUES (:email, :hash, NOW(), :firstname, :lastname)');
    $stmt->execute([':email' => $email, ':hash' => $hash, ':firstname' => $firstname, ':lastname' => $lastname]);
    $userId = $pdo->lastInsertId();
    jsonResponse(['ok' => true, 'user_id' => (int)$userId], 201);
}

function login($CONFIG){
    // Rate limit: 10 login attempts per IP per 15 minutes
    rateLimitCheck('login', 10, 900);

    $data = getJsonInput();

    $email = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';

    if (empty($email) || empty($password)) {
        jsonResponse(['error' => 'email and password required'], 400);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['error' => 'invalid email format'], 400);
    }

    $email = mb_strtolower($email);

    // Account lockout: 5 failed attempts per email locks the account for 15 minutes
    if (rateLimitIsAccountLocked($email, 5, 900)) {
        header('Retry-After: 900');
        jsonResponse(['error' => 'Account temporarily locked due to too many failed attempts. Please try again later.'], 429);
    }

    $pdo = getPDO($CONFIG);
    $stmt = $pdo->prepare('SELECT id, password_hash FROM users WHERE email = :email LIMIT 1');
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($password, $user['password_hash'])) {
        rateLimitLoginFailed($email, 5, 900);
        jsonResponse(['error' => 'invalid credentials'], 401);
    }

    // Successful login: clear failed attempt counter
    rateLimitClearLoginFailed($email);

    // create session token in DB
    $token = generateToken(64);
    $stmt = $pdo->prepare('INSERT INTO sessions (user_id, token, created_at, expires_at) VALUES (:uid, :token, NOW(), NOW() + INTERVAL \'172800 seconds\')');
    $stmt->execute([':uid' => $user['id'], ':token' => $token]);

    setSessionCookie($CONFIG, $token);
    jsonResponse(['ok' => true]);
}

function logout($CONFIG){
    $user = getAuthenticatedUser($CONFIG);
    if (!$user) return jsonResponse(['ok' => true]);
    $pdo = getPDO($CONFIG);
    $token = $_COOKIE[$CONFIG['cookie_name']] ?? null;
    if ($token) {
        $stmt = $pdo->prepare('DELETE FROM sessions WHERE token = :token');
        $stmt->execute([':token' => $token]);
    }
    clearSessionCookie($CONFIG);
    jsonResponse(['ok' => true]);
}

function getMe($CONFIG) {
    $user = getAuthenticatedUser($CONFIG);
    if (!$user) jsonResponse(['user' => null], 200);
    jsonResponse(['user' => ['id' => (int)$user['id'], 'email' => $user['email']]]);
}

function getUserInfos($CONFIG){
    $user_cookie = getAuthenticatedUser($CONFIG);
    if (!$user_cookie) jsonResponse(['error' => 'unauthenticated'], 401);
    $id = $user_cookie['id'];

    $pdo = getPDO($CONFIG);
    $stmt = $pdo->prepare("SELECT u.email, u.id as id, u.firstname, u.lastname FROM users u WHERE u.id = :id LIMIT 1");
    $stmt->execute([':id' => $id]);
    $user = $stmt->fetch();
    if (!$user) jsonResponse(['error' => 'user not found'], 404);
    jsonResponse(['user' => $user]);
}

function getUserAddresses($CONFIG){
    $user_cookie = getAuthenticatedUser($CONFIG);
    if (!$user_cookie) jsonResponse(['error' => 'unauthenticated'], 401);
    $id = $user_cookie['id'];
    $pdo = getPDO($CONFIG);
    $stmt = $pdo->prepare("SELECT a.id, a.user_id, a.firstname, a.lastname, a.phonenumber, a.address, a.city, a.postal_code, a.country, a.address_type, a.default_address FROM account_addresses a WHERE a.user_id = :user_id ORDER BY a.default_address DESC, a.id ASC");
    $stmt->execute([':user_id' => $id]);
    $addresses = $stmt->fetchAll();
    jsonResponse(['addresses' => $addresses]);
}

function getUserDefaultAddress($CONFIG){
    $user_cookie = getAuthenticatedUser($CONFIG);
    if (!$user_cookie) jsonResponse(['error' => 'unauthenticated'], 401);
    $id = $user_cookie['id'];
    $pdo = getPDO($CONFIG);
    $stmt = $pdo->prepare("SELECT a.id, a.user_id, a.firstname, a.lastname, a.phonenumber, a.address, a.city, a.postal_code, a.country, a.address_type, a.default_address FROM account_addresses a WHERE a.user_id = :user_id AND a.default_address IS TRUE LIMIT 1");
    $stmt->execute([':user_id' => $id]);
    $address = $stmt->fetch();
    jsonResponse(['address' => $address]);
}

function getUserAddress($CONFIG){
    $user_cookie = getAuthenticatedUser($CONFIG);
    if (!$user_cookie) jsonResponse(['error' => 'unauthenticated'], 401);
    $addressId = $_GET['address_id'] ?? null;
    if (!$addressId) jsonResponse(['error' => 'address_id is required'], 400);
    $id = $user_cookie['id'];
    $pdo = getPDO($CONFIG);
    $stmt = $pdo->prepare("SELECT a.id, a.user_id, a.firstname, a.lastname, a.phonenumber, a.address, a.city, a.postal_code, a.country, a.address_type, a.default_address FROM account_addresses a WHERE a.user_id = :user_id AND a.id = :addressId LIMIT 1");
    $stmt->execute([':user_id' => $id, ':addressId' =>$addressId]);
    $address = $stmt->fetch();
    jsonResponse(['address' => $address]);
}

function saveAddress($CONFIG){
    $user = getAuthenticatedUser($CONFIG);

    if (!$user) jsonResponse(['error' => 'unauthenticated'], 401);

    $userId = $user['id'];

    $pdo = getPDO($CONFIG);

    $data = getJsonInput();

    if (empty($data)) {
        jsonResponse(['error' => 'invalid request body'], 400);
    }

    if(isset(
        $data['id'],
        $data['firstname'],
        $data['lastname'],
        $data['address'],
        $data['city'],
        $data['postalcode'],
        $data['phone'],
        $data['country'])){
            
            $addressId  = $data['id'];
            $firstname  = $data['firstname'];
            $lastname   = $data['lastname'];
            $address    = $data['address'];
            $city       = $data['city'];
            $postalCode = $data['postalcode'];
            $phone      = $data['phone'];
            $country    = $data['country'];
                       
            $stmt = $pdo->prepare('UPDATE account_addresses set firstname=:firstname, lastname=:lastname, phonenumber=:phonenumber, address=:address, city=:city, postal_code=:postalcode, country=:country WHERE user_id=:userId AND id=:addressId');
            $stmt->execute([':firstname' => $firstname, ':lastname' => $lastname,':user_id' => $userId, ':phone' => $phone, ':address' => $address, ':city' => $city, ':postal_code' => $postalCode, ':country' => $country, ':address_type' => 1, ':addressId'=>$addressId]);
            
    }
    
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

            $stmt = $pdo->prepare('INSERT INTO account_addresses(user_id, firstname, lastname, phonenumber, address, city, postal_code, country, address_type, default_adress) VALUES (:user_id, :firstname, :lastname, :phone, :address, :city, :postal_code, :country, :address_type, true)');
            $stmt->execute([':user_id' => $userId, ':firstname' => $firstname, ':lastname' => $lastname, ':phone' => $phone, ':address' => $address, ':city' => $city, ':postal_code' => $postalCode, ':country' => $country, ':address_type' => 1]);
            $shippingAddressId = $pdo->lastInsertId();
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

function checkout($CONFIG){
    $user = getAuthenticatedUser($CONFIG);
    if (!$user) jsonResponse(['error' => 'unauthenticated'], 401);
    $pdo = getPDO($CONFIG);
    // Get cart items
    $stmt = $pdo->prepare('SELECT ci.product_id, ci.quantity, p.price FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.user_id = :uid');
    $stmt->execute([':uid' => $user['id']]);
    $items = $stmt->fetchAll();
    if (empty($items)) jsonResponse(['error' => 'cart empty'], 400);
    // create order
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('INSERT INTO orders (user_id, total_cents, status, created_at) VALUES (:uid, :total, :status, NOW())');
    $total = 0;
    foreach ($items as $it) $total += $it['price'] * $it['quantity'];
    // assuming price stored in cents
    $stmt->execute([':uid' => $user['id'], ':total' => $total, ':status' => 'pending']);
    $orderId = $pdo->lastInsertId();
    $stmt = $pdo->prepare('INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES (:oid, :pid, :qty, :price)');
    foreach ($items as $it) {
        $stmt->execute([':oid' => $orderId, ':pid' => $it['product_id'], ':qty' => $it['quantity'], ':price' => $it['price']]);
    }
    // clear cart
    $stmt = $pdo->prepare('DELETE FROM cart_items WHERE user_id = :uid');
    $stmt->execute([':uid' => $user['id']]);
    $pdo->commit();
    jsonResponse(['ok' => true, 'order_id' => (int)$orderId]);
}

function getProducts($cfg){
    $pdo = getPDO($cfg);
    $pg = getPaginationParams();

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM products');
    $stmt->execute();
    $total = (int)$stmt->fetchColumn();

    $stmt = $pdo->prepare('SELECT p.id, p.name, p.price, p.picture, p.category, p.active FROM products as p ORDER BY p.id LIMIT :limit OFFSET :offset');
    $stmt->bindValue(':limit', $pg['perPage'], PDO::PARAM_INT);
    $stmt->bindValue(':offset', $pg['offset'], PDO::PARAM_INT);
    $stmt->execute();
    $products = $stmt->fetchAll();

    paginatedResponse($products, $total, $pg);
}

function getActiveProducts($CONFIG){
    $pdo = getPDO($CONFIG);
    $pg = getPaginationParams();

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM products WHERE active IS TRUE');
    $stmt->execute();
    $total = (int)$stmt->fetchColumn();

    $stmt = $pdo->prepare('SELECT p.id, p.name, p.price, p.picture, p.category FROM products as p WHERE p.active IS TRUE ORDER BY p.id LIMIT :limit OFFSET :offset');
    $stmt->bindValue(':limit', $pg['perPage'], PDO::PARAM_INT);
    $stmt->bindValue(':offset', $pg['offset'], PDO::PARAM_INT);
    $stmt->execute();
    $products = $stmt->fetchAll();

    paginatedResponse($products, $total, $pg);
}

function getProduct($CONFIG){
    $productId = $_GET['id'] ?? null;
    if (!$productId) jsonResponse(['error' => 'id is required'], 400);
    $pdo = getPDO($CONFIG);
    $stmt = $pdo->prepare('SELECT p.id, p.name, p.price, p.picture, p.category, p.details, p.active , p.secondary_pictures, p.colors FROM products as p WHERE p.id = :productId ORDER BY p.id;');
    $stmt->execute([':productId' => $productId]);
    $product = $stmt->fetchAll();
    jsonResponse($product);
}

function getProductMin($CONFIG){
    $productId = $_GET['id'] ?? null;
    if (!$productId) jsonResponse(['error' => 'id is required'], 400);
    $pdo = getPDO($CONFIG);
    $stmt = $pdo->prepare('SELECT p.id, p.name, p.price FROM products as p WHERE p.id = :productId ORDER BY p.id;');
    $stmt->execute([':productId' => $productId]);
    $product = $stmt->fetchAll();
    jsonResponse($product);
}

function addToCart(){
    $data = getJsonInput();

    if (empty($data['id']) || !isset($data['qty']) || empty($data['size']) || empty($data['clr'])) {
        jsonResponse(['error' => 'id, qty, size, and clr are required'], 400);
    }

    $productId = (int)$data['id'];
    $quantity = max(1, (int)$data['qty']);
    $size = substr(trim($data['size']), 0, 10);
    $clr = substr(trim($data['clr']), 0, 10);
    session_start();
    
    if (!isset($_SESSION['cart'])) {
        $_SESSION['cart'] = [];
    }
    
    $productKey = sprintf("%05d", $productId).strtoupper(sprintf("%03s", $size)).strtoupper($clr);
    
    if (isset($_SESSION['cart'][$productKey])) {
        $_SESSION['cart'][$productKey] += $quantity;
    } else {
        $_SESSION['cart'][$productKey] = $quantity;
    }
    
    jsonResponse("add to cart method POST");
    
}

function getCart(){
    session_start();
    
    if (!isset($_SESSION['cart'])) {
        $_SESSION['cart'] = [];
    }

    $cartItems = [];
    foreach ($_SESSION['cart'] as $key => $value) {
        $cartItems[] = ['product' => $key, 'quantity' => $value];
    }

    jsonResponse(json_encode($cartItems));
}

function emptyCart(){
    session_start();
    if(isset($_SESSION['cart'])){
        unset($_SESSION['cart']);
    }
    
    
    jsonResponse("Cart is empty");
}

function cartQtyDwn(){
    session_start();
    $productKey = $_GET['pkey'] ?? null;
    if (!$productKey) jsonResponse(['error' => 'pkey is required'], 400);
    if(isset($_SESSION['cart'][$productKey])){
        if($_SESSION['cart'][$productKey]==1){
            unset($_SESSION['cart'][$productKey]);
        }else if($_SESSION['cart'][$productKey]>1)
            $_SESSION['cart'][$productKey] -= 1;
    }
    jsonResponse("Cart modified");
}

function cartQtyUp(){
    session_start();
    $productKey = $_GET['pkey'] ?? null;
    if (!$productKey) jsonResponse(['error' => 'pkey is required'], 400);
    if(isset($_SESSION['cart'][$productKey])){
        
        $_SESSION['cart'][$productKey] += 1;
    }else{
        $_SESSION['cart'][$productKey] = 1;
    }
    jsonResponse("Cart modified");
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

function getOrder($CONFIG){
    $user = getAuthenticatedUser($CONFIG);
    if (!$user) jsonResponse(['error' => 'unauthenticated'], 401);

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

// Enforce CSRF on state-changing requests (login and register are exempt
// because the user has no session yet at those endpoints)
$csrfExemptPaths = ['/login', '/register'];
if ($method === 'POST' && !in_array($path, $csrfExemptPaths, true)) {
    csrfProtect();
}

// Provide a GET endpoint so the frontend can fetch a fresh CSRF token
if ($method === 'GET' && $path === '/csrf_token') {
    jsonResponse(['csrf_token' => csrfGetToken()]);
}

try {
    if ($method === 'POST' && $path === '/register') {
        register($CONFIG);
    }
    
    if ($method === 'POST' && $path === '/login') {
        login($CONFIG);
    }
    
    if ($method === 'GET' && $path === '/logout') {
        logout($CONFIG);
    }
    
    if ($method === 'GET' && $path === '/me') {
        getMe($CONFIG);
    }
    
    if ($method == 'GET' && $path == '/user_infos'){
        getUserInfos($CONFIG);
    }
    
    if ($method == 'GET' && $path == '/user_addresses'){
        getUserAddresses($CONFIG);
    }
    
    if ($method == 'GET' && $path == '/user_default_address'){
        getUserDefaultAddress($CONFIG);
    }
    
    if ($method == 'GET' && $path == '/user_address'){
        getUserAddress($CONFIG);
    }
    
    if($method === 'POST' && $path === '/save_address'){
        saveAddress($CONFIG);
    }
    
    if ($method === 'POST' && $path === '/checkout') {
        checkout($CONFIG);
    }
    
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
    
    if($method==='POST' && $path === '/cart_add'){
        addToCart();
    }

    if($method==='GET' && $path === '/cart'){
        getCart();
    }
    
    if($method=='GET' && $path == '/empty_cart'){
        emptyCart();
    }
    
    if($method=='GET' && $path == '/cart_qty_dwn'){
        cartQtyDwn();
    }
    
    if($method=='GET' && $path == '/cart_qty_up'){
        cartQtyUp();
    }
    
    if($method=='GET' && $path=='/orders'){
        getOrders($CONFIG);
    }
    
    if($method=='GET' && $path=='/user_orders'){
        getUserOrders($CONFIG);
    }
    
    if($method=='GET' && $path=='/order'){
        getOrder($CONFIG);
    }
    
    if($method === 'POST' && $path === '/save_payed_order'){
        savePayedOrder($CONFIG);
    }
    

    // Unknown route
    jsonResponse(['error' => 'not_found', 'message' => 'Route not found: ' . $path], 404);

} catch (Exception $e) {
    logError('Unhandled exception', ['exception' => $e->getMessage(), 'file' => $e->getFile(), 'line' => $e->getLine()]);
    jsonResponse(['error' => 'server_error', 'message' => 'An unexpected error occurred.'], 500);
}
