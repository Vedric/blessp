<?php
    header('Content-Type: application/json');
    include '../config.php';
    include '../authent.php';
    include_once __DIR__ . '/../csrf.php';

    // CSRF protection (token can come via header or POST field)
    csrfProtect();

    $loggedUser = getAuthenticatedUser($config);

    if(!$loggedUser || !$loggedUser['admin']){
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden: admin access required.']);
        exit;
    }

    $uploadDir = '../img/';
    $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    $maxFileSize = 5 * 1024 * 1024; // 5 MB

    $productId = $_POST['productId'] ?? null;
    $productName = $_POST['productName'] ?? '';
    $price = $_POST['price'] ?? 0;
    $categories = $_POST['categories'] ?? '';
    $details = $_POST['details'] ?? '';
    $imagePath = null;
    $active = $_POST['active'] ?? 'true';
    $secondaryPictures = $_POST['secondary_pictures'] ?? '';
    $colors = $_POST['colors'] ?? '';
    $onfront_order = $_POST['onfront_order'] ?? 0;

    // File upload with validation
    if (!empty($_FILES['productPicture']['name'])) {
        $originalName = $_FILES['productPicture']['name'];
        $fileSize = $_FILES['productPicture']['size'];
        $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

        if (!in_array($extension, $allowedExtensions)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid file type. Allowed: ' . implode(', ', $allowedExtensions)]);
            exit;
        }

        if ($fileSize > $maxFileSize) {
            http_response_code(400);
            echo json_encode(['error' => 'File too large. Maximum size: 5 MB.']);
            exit;
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $_FILES['productPicture']['tmp_name']);
        finfo_close($finfo);
        $allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

        if (!in_array($mimeType, $allowedMimes)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid MIME type detected.']);
            exit;
        }

        $fileName = time() . '_' . basename($originalName);
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