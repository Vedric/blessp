<?php
    header('Content-Type: application/json');
    include '../config.php';
    include '../authent.php';

    $loggedUser = getAuthenticatedUser($config);

    if(!$loggedUser || !$loggedUser['admin']){
        "You are not logged or are not admin.";
    }

    $uploadDir = '../img/';

    $productId = $_POST['productId'] ?? null;
    $productName = $_POST['productName'] ?? '';
    $price = $_POST['price'] ?? 0;
    $categories = $_POST['categories'] ?? '';
    $details = $_POST['details'] ?? '';
    $imagePath = null;
    $active = $_POST['active'] ?? 'true';
    $secondaryPictures = $_POST['secondary_pictures'];
    $colors = $_POST['colors'];
    $onfront_order = $_POST['onfront_order'];

    $fileName = $_FILES['productPicture']['name'];
    $tmpFileName = $_FILES['productPicture']['tmp_name'];
    // Gestion upload image
    if (!empty($_FILES['productPicture']['name'])) {
        $fileName = time() . '_' . basename($_FILES['productPicture']['name']);
        $targetPath = $uploadDir . $fileName;

        if (move_uploaded_file($_FILES['productPicture']['tmp_name'], $targetPath)) {
            $imagePath = $targetPath;
        }
    }
    
    // Connexion BDD (exemple PDO)
    $pdo = new PDO($config['db_dsn'], $config['db_user'], $config['db_pass']);
    
    if ($productId) {

        if(!$imagePath){
            $stmt = $pdo->prepare('SELECT picture FROM products WHERE id=:productId');
            $stmt->execute([':productId'=>$productId]);
            $fetchPictureResults = $stmt->fetchAll();
            $imagePath=$fetchPictureResults[0]['picture'];
        }

        $stmt = $pdo->prepare('UPDATE products SET name=:name, price=:price, category=:category, details=:details, picture=:picture, active=:active, secondary_pictures=:secondaryPictures, colors=:colors, onfront_order=:onfront_order WHERE id=:productId');
        $stmt->execute([':name'=>$productName, ':price'=>$price, ':category'=>$categories, ':details'=>$details, ':picture'=>$imagePath, ':active'=>$active, ':secondaryPictures' => $secondaryPictures, ':colors'=> $colors, ':onfront_order'=>$onfront_order,':productId'=>$productId]);
       
    } else {
        // INSERT
        $stmt = $pdo->prepare("INSERT INTO products (name, price, category, details, picture, active, secondary_pictures, colors) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$productName, $price, $categories, $details, $imagePath, $active, $secondaryPictures, $colors]);
    }

    echo json_encode([
        'success' => true,
        'message' => 'Produit sauvegardé avec succès',
        'active' => $active
        
    ]);
?>