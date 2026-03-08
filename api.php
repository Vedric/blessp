<?php
use Shop\Order;
use Shop\OrderItem;
include 'order.php';
include 'order_item.php';
include './config.php';
//include 'api_helper.php';


// api-php-user-cart.php
// Minimal REST API in plain PHP to manage users + 48h persistent session + shopping cart
// Requirements: PHP 7.4+, PDO extension, HTTPS in production

// -----------------------------
// Configuration
// -----------------------------

// $CONFIG = [
//     'db_dsn' => 'pgsql:host=127.0.0.1;port=5432;dbname=blessp',
//     'db_user' => 'postgres',
//     'db_pass' => 'postgres',
//     'cookie_name' => 'session_token',
//     'session_lifetime_seconds' => 48 * 3600, // 48 hours
//     'cookie_path' => '/',
//     'cookie_secure' => false, // set to true in production (requires HTTPS)
//     'cookie_httponly' => true,
//     'cookie_samesite' => 'Strict',
// ];

$CONFIG = getConfig();

// -----------------------------
// Rate limiting
// -----------------------------
include_once __DIR__ . '/rate_limit.php';

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

function getPDO($C) {
    static $pdo = null;
    if ($pdo) return $pdo;
    $pdo = new PDO($C['db_dsn'], $C['db_user'], $C['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    return $pdo;
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

// Authentication: read session token from cookie and validate
function getAuthenticatedUser($C) {
    if (empty($_COOKIE[$C['cookie_name']])) return null;
    $token = $_COOKIE[$C['cookie_name']];
    $pdo = getPDO($C);
    $stmt = $pdo->prepare("SELECT s.user_id, u.email, u.id as id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = :token AND s.expires_at > NOW() LIMIT 1");
    $stmt->execute([':token' => $token]);
    $user = $stmt->fetch();
    return $user ?: null;
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

// Route mapping (simple)
// POST /register
// POST /login
// POST /logout
// GET  /me
// POST /cart/items   {product_id, quantity}
// GET  /cart/items
// PUT  /cart/items/{product_id} {quantity}
// DELETE /cart/items/{product_id}
// POST /checkout

function register($CONFIG){
    // Rate limit: 5 registration attempts per IP per 15 minutes
    rateLimitCheck('register', 5, 900);

    $data = getJsonInput();
    if (empty($data['email']) || empty($data['password'])) {
        jsonResponse(['error' => 'email and password required'], 400);
    }
    $pdo = getPDO($CONFIG);
    // check existing
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $stmt->execute([':email' => $data['email']]);
    if ($stmt->fetch()) jsonResponse(['error' => 'email already used'], 409);
    $hash = password_hash($data['password'], PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('INSERT INTO users (email, password_hash, created_at, firstname, lastname) VALUES (:email, :hash, NOW(), :firstname, :lastname)');
    $stmt->execute([':email' => $data['email'], ':hash' => $hash, ':firstname' => $data['firstname'], ':lastname' => $data['lastname']]);
    $userId = $pdo->lastInsertId();
    jsonResponse(['ok' => true, 'user_id' => (int)$userId], 201);
}

function login($CONFIG){
    // Rate limit: 10 login attempts per IP per 15 minutes
    rateLimitCheck('login', 10, 900);

    $data = getJsonInput();
    if (empty($data['email']) || empty($data['password'])) {
        jsonResponse(['error' => 'email and password required'], 400);
    }

    $email = $data['email'];

    // Account lockout: 5 failed attempts per email locks the account for 15 minutes
    if (rateLimitIsAccountLocked($email, 5, 900)) {
        header('Retry-After: 900');
        jsonResponse(['error' => 'Account temporarily locked due to too many failed attempts. Please try again later.'], 429);
    }

    $pdo = getPDO($CONFIG);
    $stmt = $pdo->prepare('SELECT id, password_hash FROM users WHERE email = :email LIMIT 1');
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($data['password'], $user['password_hash'])) {
        rateLimitLoginFailed($email, 5, 900);
        jsonResponse(['error' => 'invalid credentials'], 401);
    }

    // Successful login: clear failed attempt counter
    rateLimitClearLoginFailed($email);

    // create session token in DB
    $token = generateToken(64);
    $stmt = $pdo->prepare('INSERT INTO sessions (user_id, token, created_at, expires_at) VALUES (:uid, :token, NOW(), date_add(now(), INTERVAL \'172800\'))');
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
    $id = $user_cookie['id'];
    
    $pdo = getPDO($CONFIG);
    $stmt = $pdo->prepare("SELECT u.email, u.id as id, u.firstname, u.lastname FROM users u WHERE u.id = :id LIMIT 1");
    $stmt->execute([':id' => $id]);
    $user = $stmt->fetch();
    jsonResponse(['user' => $user]);
    
}

function getUserAddresses($CONFIG){
    $user_cookie = getAuthenticatedUser($CONFIG);
    $id = $user_cookie['id'];
    $pdo = getPDO($CONFIG);
    $stmt = $pdo->prepare("SELECT a.id, a.user_id, a.firstname, a.lastname, a.phonenumber, a.address, a.city, a.postal_code, a.country, a.address_type, a.default_address FROM account_addresses a WHERE a.user_id = :user_id ORDER BY a.default_address DESC, a.id ASC");
    $stmt->execute([':user_id' => $id]);
    $addresses = $stmt->fetchAll();
    jsonResponse(['addresses' => $addresses]);
}

function getUserDefaultAddress($CONFIG){
    $user_cookie = getAuthenticatedUser($CONFIG);
    $id = $user_cookie['id'];
    $pdo = getPDO($CONFIG);
    $stmt = $pdo->prepare("SELECT a.id, a.user_id, a.firstname, a.lastname, a.phonenumber, a.address, a.city, a.postal_code, a.country, a.address_type, a.default_address FROM account_addresses a WHERE a.user_id = :user_id AND a.default_address IS TRUE LIMIT 1");
    $stmt->execute([':user_id' => $id]);
    $address = $stmt->fetch();
    jsonResponse(['address' => $address]);
}

function getUserAddress($CONFIG){
    $addressId= $_GET['address_id'];
    $user_cookie = getAuthenticatedUser($CONFIG);
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
    
    $raw = file_get_contents('php://input');
    
    $data = getJsonInput();
    
    // Vérification d'erreurs de décodage
    if (json_last_error() !== JSON_ERROR_NONE) {
        jsonResponse("Erreur JSON : " . json_last_error_msg());
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
    $stmt = $pdo->prepare('SELECT p.id, p.name, p.price, p.picture, p.category, p.active FROM products as p ORDER BY p.id;');
    $stmt->execute();
    $products = $stmt->fetchAll();
    jsonResponse(['products' => $products]);
}

function getActiveProducts($CONFIG){
    $pdo = getPDO($CONFIG);
    $stmt = $pdo->prepare('SELECT p.id, p.name, p.price, p.picture, p.category FROM products as p WHERE p.active IS TRUE ORDER BY p.id;');
    $stmt->execute();
    $products = $stmt->fetchAll();
    jsonResponse(['products' => $products]);
}

function getProduct($CONFIG){
    $productId = $_GET['id'];
    $pdo = getPDO($CONFIG);
    $stmt = $pdo->prepare('SELECT p.id, p.name, p.price, p.picture, p.category, p.details, p.active , p.secondary_pictures, p.colors FROM products as p WHERE p.id = :productId ORDER BY p.id;');
    $stmt->execute([':productId' => $productId]);
    $product = $stmt->fetchAll();
    jsonResponse($product);
}

function getProductMin($CONFIG){
    $productId = $_GET['id'];
    $pdo = getPDO($CONFIG);
    $stmt = $pdo->prepare('SELECT p.id, p.name, p.price FROM products as p WHERE p.id = :productId ORDER BY p.id;');
    $stmt->execute([':productId' => $productId]);
    $product = $stmt->fetchAll();
    jsonResponse($product);
}

function addToCart(){
    $data = getJsonInput();
    
    $productId = $data['id'];
    $quantity = $data['qty'];
    $size = $data['size'];
    $clr = $data['clr'];
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
    
    $resp = "";
    if (!isset($_SESSION['cart'])) {
        $_SESSION['cart'] = [];
    }
    
    $cart = $_SESSION['cart'];
    
    $keys = array_keys($_SESSION['cart']);
    
    $resp = "[";
    foreach($keys as $key){
        $value = $_SESSION['cart'][$key];
        $resp = $resp."{\"product\":\"".$key."\",\"quantity\":".$value."},";
    }
    
    if(str_ends_with($resp,",")){
        $resp = substr($resp,0,strlen($resp)-1);
    }
    
    $resp = $resp."]";
    
    
    jsonResponse($resp);
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
    $productKey = $_GET['pkey'];
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
    $productKey = $_GET['pkey'];
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
        
        $stmt = $pdo->prepare('SELECT * FROM account_addresses WHERE id=:addressId');
        $stmt->execute([':addressId'=>$orderInfos['shipping_address_id']]);
        $fetchAddressResults = $stmt->fetchAll();
        
        $shippingAddress = $fetchAddressResults[0];
        
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
        
        $order = new Order($orderInfos, $customer, $shippingAddress, $orderItems);
        $userOrders[] = $order;
    }
    jsonResponse($userOrders);
}

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
    
    $order = new Order($orderInfos, $customer, $shippingAddress, $orderItems);
    
    jsonResponse($order);
    
}

try {
    
    
    // CART: all require authentication
    /*if (preg_match('#^/cart/items(?:/([^/]+))?$#', $path, $m)) {
        $user = getAuthenticatedUser($CONFIG);
        if (!$user) jsonResponse(['error' => 'unauthenticated'], 401);
        $pdo = getPDO($CONFIG);
        $productIdFromPath = $m[1] ?? null;

        if ($method === 'POST' && !$productIdFromPath) {
            $data = getJsonInput();
            if (empty($data['product_id']) || !isset($data['quantity'])) jsonResponse(['error' => 'product_id and quantity required'], 400);
            $stmt = $pdo->prepare('SELECT id FROM cart_items WHERE user_id = :uid AND product_id = :pid LIMIT 1');
            $stmt->execute([':uid' => $user['id'], ':pid' => $data['product_id']]);
            $exists = $stmt->fetch();
            if ($exists) {
                $stmt = $pdo->prepare('UPDATE cart_items SET quantity = quantity + :qty, updated_at = NOW() WHERE user_id = :uid AND product_id = :pid');
                $stmt->execute([':qty' => (int)$data['quantity'], ':uid' => $user['id'], ':pid' => $data['product_id']]);
            } else {
                $stmt = $pdo->prepare('INSERT INTO cart_items (user_id, product_id, quantity, created_at, updated_at) VALUES (:uid, :pid, :qty, NOW(), NOW())');
                $stmt->execute([':uid' => $user['id'], ':pid' => $data['product_id'], ':qty' => (int)$data['quantity']]);
            }
            jsonResponse(['ok' => true]);
        }

        if ($method === 'GET' && !$productIdFromPath) {
            $stmt = $pdo->prepare('SELECT ci.product_id, ci.quantity, p.name, p.price FROM cart_items ci LEFT JOIN products p ON p.id = ci.product_id WHERE ci.user_id = :uid');
            $stmt->execute([':uid' => $user['id']]);
            $items = $stmt->fetchAll();
            jsonResponse(['items' => $items]);
        }

        if (($method === 'PUT' || $method === 'PATCH') && $productIdFromPath) {
            $data = getJsonInput();
            if (!isset($data['quantity'])) jsonResponse(['error' => 'quantity required'], 400);
            $qty = (int)$data['quantity'];
            if ($qty <= 0) {
                $stmt = $pdo->prepare('DELETE FROM cart_items WHERE user_id = :uid AND product_id = :pid');
                $stmt->execute([':uid' => $user['id'], ':pid' => $productIdFromPath]);
            } else {
                $stmt = $pdo->prepare('UPDATE cart_items SET quantity = :qty, updated_at = NOW() WHERE user_id = :uid AND product_id = :pid');
                $stmt->execute([':qty' => $qty, ':uid' => $user['id'], ':pid' => $productIdFromPath]);
            }
            jsonResponse(['ok' => true]);
        }

        if ($method === 'DELETE' && $productIdFromPath) {
            $stmt = $pdo->prepare('DELETE FROM cart_items WHERE user_id = :uid AND product_id = :pid');
            $stmt->execute([':uid' => $user['id'], ':pid' => $productIdFromPath]);
            jsonResponse(['ok' => true]);
        }
    }*/
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
    
    if($method == 'GET' && $path == '/test_save_add'){
        echo 'test_save_add : succeed';
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
    jsonResponse(['V1.0.0 > error' => $path.' not found, Script name : '.$scriptName], 404);

} catch (Exception $e) {
    error_log('Unhandled exception: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    jsonResponse(['error' => 'server_error', 'message' => 'An unexpected error occurred.'], 500);
}



// End of file
