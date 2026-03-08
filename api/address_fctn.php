<?php

function getUserAddresses($CONFIG){
    $user = getAuthenticatedUser($CONFIG);

    if (!$user) jsonResponse(['error' => 'unauthenticated'], 401);

    $id = $user['id'];
    $pdo = getPDO($CONFIG);
    $stmt = $pdo->prepare("SELECT a.id, a.user_id, a.firstname, a.lastname, a.phonenumber, a.address, a.city, a.postal_code, a.country, a.address_type, a.default_address FROM account_addresses a WHERE a.user_id = :user_id ORDER BY a.default_address DESC, a.id ASC");
    $stmt->execute([':user_id' => $id]);
    $addresses = $stmt->fetchAll();
    return $addresses;
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
        $data['phonenumber'],
        $data['country'],
        $data['default'])){

            $addressId   = $data['id'];
            $firstname   = $data['firstname'];
            $lastname    = $data['lastname'];
            $address     = $data['address'];
            $city        = $data['city'];
            $postalCode  = $data['postalcode'];
            $phonenumber = $data['phonenumber'];
            $country     = $data['country'];
            $dflt        = $data['default'];

            $stmt = $pdo->prepare('UPDATE account_addresses set firstname=:firstname, lastname=:lastname, phonenumber=:phonenumber, address=:address, city=:city, postal_code=:postalcode, country=:country, address_type=:addressType WHERE user_id=:userId AND id=:addressId');
            $stmt->execute([':firstname' => $firstname, ':lastname' => $lastname,':userId' => $userId, ':phonenumber' => $phonenumber, ':address' => $address, ':city' => $city, ':postalcode' => $postalCode, ':country' => $country, ':addressType' => 1, ':addressId'=>$addressId]);

            if(filter_var($dflt, FILTER_VALIDATE_BOOLEAN)){
                $stmt = $pdo->prepare('UPDATE account_addresses set default_address = false WHERE user_id=:userId;');
                $stmt->execute([':userId'=>$userId]);
                $stmt = $pdo->prepare('UPDATE account_addresses set default_address = true WHERE user_id=:userId AND id=:addressId');
                $stmt->execute([':userId'=>$userId, ':addressId'=>$addressId]);
            }else{
                $stmt = $pdo->prepare('UPDATE account_addresses set default_address = false WHERE user_id=:userId AND id=:addressId');
                $stmt->execute([':userId'=>$userId, ':addressId'=>$addressId]);
            }
    }
}

function addAddress($CONFIG){
    $user = getAuthenticatedUser($CONFIG);

    if (!$user) jsonResponse(['error' => 'unauthenticated'], 401);

    $userId = $user['id'];

    $pdo = getPDO($CONFIG);

    $data = getJsonInput();

    if (empty($data)) {
        jsonResponse(['error' => 'invalid request body'], 400);
    }

    if(isset(
        $data['firstname'],
        $data['lastname'],
        $data['address'],
        $data['city'],
        $data['postalcode'],
        $data['phonenumber'],
        $data['country'],
        $data['default'])){

            $firstname   = $data['firstname'];
            $lastname    = $data['lastname'];
            $address     = $data['address'];
            $city        = $data['city'];
            $postalCode  = $data['postalcode'];
            $phonenumber = $data['phonenumber'];
            $country     = $data['country'];
            $dflt        = $data['default'];

            $dfltBln = filter_var($dflt, FILTER_VALIDATE_BOOLEAN);

            $stmt = $pdo->prepare('INSERT INTO account_addresses(user_id, firstname, lastname, phonenumber, address, city, postal_code, country, address_type, default_address) VALUES (:userId, :firstname, :lastname, :phonenumber, :address, :city, :postalcode, :country, :addressType, :dflt)');

            $stmt->execute([
                ':firstname' => $firstname,
                ':lastname' => $lastname,
                ':userId' => $userId,
                ':phonenumber' => $phonenumber,
                ':address' => $address,
                ':city' => $city,
                ':postalcode' => $postalCode,
                ':country' => $country,
                ':addressType' => 1,
                ':dflt'=>$dfltBln
            ]);
    }
}

function deleteAddress($CONFIG){
    $user = getAuthenticatedUser($CONFIG);
    if (!$user) jsonResponse(['error' => 'unauthenticated'], 401);
    $userId = $user['id'];
    $addressId = $_GET['addressId'] ?? null;
    if (!$addressId) jsonResponse(['error' => 'addressId is required'], 400);

    $pdo = getPDO($CONFIG);

    $stmt = $pdo->prepare('DELETE FROM account_addresses WHERE user_id=:userId and id=:addressId');
    $stmt->execute([':userId'=>$userId, ':addressId'=>$addressId]);
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

?>
