<?php

function getProducts($cfg){
    $pdo = getPDO($cfg);
    $pg = getPaginationParams();

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM products');
    $stmt->execute();
    $total = (int)$stmt->fetchColumn();

    $stmt = $pdo->prepare('SELECT p.id, p.name, p.price, p.picture, p.category, p.active, p.onfront_order FROM products as p ORDER BY p.id LIMIT :limit OFFSET :offset');
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
    $stmt = $pdo->prepare('SELECT p.id, p.name, p.price, p.picture, p.category, p.details, p.active, p.secondary_pictures, p.colors, p.onfront_order FROM products as p WHERE p.id = :productId ORDER BY p.id;');
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

function getOnFrontProducts($CONFIG){
    $pdo = getPDO($CONFIG);
    $pg = getPaginationParams();

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM products WHERE active IS TRUE AND onfront_order IS NOT NULL AND onfront_order > 0');
    $stmt->execute();
    $total = (int)$stmt->fetchColumn();

    $stmt = $pdo->prepare('SELECT p.id, p.name, p.price, p.picture, p.category FROM products as p WHERE p.active IS TRUE AND p.onfront_order IS NOT NULL AND p.onfront_order > 0 ORDER BY p.onfront_order LIMIT :limit OFFSET :offset');
    $stmt->bindValue(':limit', $pg['perPage'], PDO::PARAM_INT);
    $stmt->bindValue(':offset', $pg['offset'], PDO::PARAM_INT);
    $stmt->execute();
    $products = $stmt->fetchAll();

    paginatedResponse($products, $total, $pg);
}

?>
