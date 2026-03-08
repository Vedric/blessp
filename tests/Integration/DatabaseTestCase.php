<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

/**
 * Base class for integration tests that require a PostgreSQL database.
 *
 * Loads the schema once per suite run and truncates all tables between
 * tests so each test starts with a clean state.
 */
abstract class DatabaseTestCase extends TestCase
{
    protected static ?PDO $pdo = null;

    public static function setUpBeforeClass(): void
    {
        $dsn  = getenv('DB_DSN')  ?: 'pgsql:host=127.0.0.1;port=5432;dbname=blessp_test';
        $user = getenv('DB_USER') ?: 'postgres';
        $pass = getenv('DB_PASS') ?: 'postgres';

        try {
            self::$pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
        } catch (PDOException $e) {
            self::markTestSkipped('PostgreSQL is not available: ' . $e->getMessage());
        }

        $schema = file_get_contents(dirname(__DIR__) . '/schema.sql');
        self::$pdo->exec($schema);
    }

    protected function setUp(): void
    {
        // Truncate all tables in dependency-safe order
        self::$pdo->exec('
            TRUNCATE TABLE order_items, cart_items, orders,
                          account_addresses, sessions, products, users
            RESTART IDENTITY CASCADE
        ');
    }

    public static function tearDownAfterClass(): void
    {
        self::$pdo = null;
    }

    // ── Test fixture helpers ──────────────────────────────────────

    protected function createUser(array $overrides = []): array
    {
        $data = array_merge([
            'email' => 'test@example.com',
            'password_hash' => password_hash('TestPass123', PASSWORD_DEFAULT),
            'firstname' => 'Test',
            'lastname' => 'User',
            'admin' => false,
        ], $overrides);

        $stmt = self::$pdo->prepare('
            INSERT INTO users (email, password_hash, firstname, lastname, admin, created_at)
            VALUES (:email, :password_hash, :firstname, :lastname, :admin, NOW())
        ');
        $stmt->execute([
            ':email' => $data['email'],
            ':password_hash' => $data['password_hash'],
            ':firstname' => $data['firstname'],
            ':lastname' => $data['lastname'],
            ':admin' => $data['admin'] ? 'true' : 'false',
        ]);

        $data['id'] = (int) self::$pdo->lastInsertId();
        return $data;
    }

    protected function createSession(int $userId, string $token = null, int $ttlSeconds = 172800): array
    {
        $token = $token ?? bin2hex(random_bytes(32));
        $stmt = self::$pdo->prepare("
            INSERT INTO sessions (user_id, token, created_at, expires_at)
            VALUES (:user_id, :token, NOW(), NOW() + INTERVAL '{$ttlSeconds} seconds')
        ");
        $stmt->execute([':user_id' => $userId, ':token' => $token]);

        return [
            'id' => (int) self::$pdo->lastInsertId(),
            'user_id' => $userId,
            'token' => $token,
        ];
    }

    protected function createProduct(array $overrides = []): array
    {
        $data = array_merge([
            'name' => 'Test Product',
            'price' => 2999,
            'picture' => 'test.jpg',
            'category' => '[streetwear]',
            'details' => 'A test product',
            'active' => true,
        ], $overrides);

        $stmt = self::$pdo->prepare('
            INSERT INTO products (name, price, picture, category, details, active)
            VALUES (:name, :price, :picture, :category, :details, :active)
        ');
        $stmt->execute([
            ':name' => $data['name'],
            ':price' => $data['price'],
            ':picture' => $data['picture'],
            ':category' => $data['category'],
            ':details' => $data['details'],
            ':active' => $data['active'] ? 'true' : 'false',
        ]);

        $data['id'] = (int) self::$pdo->lastInsertId();
        return $data;
    }

    protected function createAddress(int $userId, array $overrides = []): array
    {
        $data = array_merge([
            'firstname' => 'Test',
            'lastname' => 'User',
            'phonenumber' => '5141234567',
            'address' => '123 Main St',
            'city' => 'Montreal',
            'postal_code' => 'H2X 1Y4',
            'country' => 'CA',
            'address_type' => 1,
            'default_address' => false,
        ], $overrides);

        $stmt = self::$pdo->prepare('
            INSERT INTO account_addresses
                (user_id, firstname, lastname, phonenumber, address, city, postal_code, country, address_type, default_address)
            VALUES
                (:user_id, :firstname, :lastname, :phonenumber, :address, :city, :postal_code, :country, :address_type, :default_address)
        ');
        $stmt->execute([
            ':user_id' => $userId,
            ':firstname' => $data['firstname'],
            ':lastname' => $data['lastname'],
            ':phonenumber' => $data['phonenumber'],
            ':address' => $data['address'],
            ':city' => $data['city'],
            ':postal_code' => $data['postal_code'],
            ':country' => $data['country'],
            ':address_type' => $data['address_type'],
            ':default_address' => $data['default_address'] ? 'true' : 'false',
        ]);

        $data['id'] = (int) self::$pdo->lastInsertId();
        $data['user_id'] = $userId;
        return $data;
    }

    protected function createOrder(int $userId, array $overrides = []): array
    {
        $data = array_merge([
            'amount' => 59.98,
            'status' => 'PAYED',
            'transaction_key' => 'TXN_' . bin2hex(random_bytes(8)),
            'shipping_address' => '{}',
        ], $overrides);

        $stmt = self::$pdo->prepare('
            INSERT INTO orders (user_id, amount, status, transaction_key, shipping_address, created_at)
            VALUES (:user_id, :amount, :status, :transaction_key, :shipping_address, NOW())
        ');
        $stmt->execute([
            ':user_id' => $userId,
            ':amount' => $data['amount'],
            ':status' => $data['status'],
            ':transaction_key' => $data['transaction_key'],
            ':shipping_address' => $data['shipping_address'],
        ]);

        $data['id'] = (int) self::$pdo->lastInsertId();
        $data['user_id'] = $userId;
        return $data;
    }

    protected function createOrderItem(int $orderId, array $overrides = []): array
    {
        $data = array_merge([
            'product_key' => '00001 M BLK',
            'quantity' => 1,
            'unit_price_cents' => 2999,
        ], $overrides);

        $stmt = self::$pdo->prepare('
            INSERT INTO order_items (order_id, product_key, quantity, unit_price_cents)
            VALUES (:order_id, :product_key, :quantity, :unit_price_cents)
        ');
        $stmt->execute([
            ':order_id' => $orderId,
            ':product_key' => $data['product_key'],
            ':quantity' => $data['quantity'],
            ':unit_price_cents' => $data['unit_price_cents'],
        ]);

        $data['id'] = (int) self::$pdo->lastInsertId();
        $data['order_id'] = $orderId;
        return $data;
    }
}
