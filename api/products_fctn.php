<?php
function getProducts($cfg){
    $pdo = getPDO($cfg);
    $stmt = $pdo->prepare('SELECT p.id, p.name, p.price, p.picture, p.category, p.active, p.onfront_order FROM products as p ORDER BY p.id;');
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
    $stmt = $pdo->prepare('SELECT p.id, p.name, p.price, p.picture, p.category, p.details, p.active , p.secondary_pictures, p.colors, p.onfront_order FROM products as p WHERE p.id = :productId ORDER BY p.id;');
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

function getOnFrontProducts($CONFIG){
    $pdo = getPDO($CONFIG);
    $stmt = $pdo->prepare('SELECT p.id, p.name, p.price, p.picture, p.category FROM products as p WHERE p.active IS TRUE AND p.onfront_order IS NOT NULL AND p.onfront_order > 0 ORDER BY p.onfront_order;');
    $stmt->execute();
    $products = $stmt->fetchAll();
    jsonResponse(['products' => $products]);
}

?>
