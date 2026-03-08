<?php

declare(strict_types=1);

require_once __DIR__ . '/DatabaseTestCase.php';

final class OrderIntegrationTest extends DatabaseTestCase
{
    // ── Order creation ────────────────────────────────────────────

    public function testCreateOrderWithItems(): void
    {
        $user = $this->createUser();
        $product = $this->createProduct(['name' => 'T-Shirt', 'price' => 2999]);

        $order = $this->createOrder($user['id'], [
            'amount' => 59.98,
            'status' => 'PAYED',
        ]);

        $this->createOrderItem($order['id'], [
            'product_key' => sprintf('%05d', $product['id']) . ' M BLK',
            'quantity' => 2,
            'unit_price_cents' => 2999,
        ]);

        // Verify order
        $stmt = self::$pdo->prepare('SELECT * FROM orders WHERE id = :id');
        $stmt->execute([':id' => $order['id']]);
        $result = $stmt->fetch();

        $this->assertSame('PAYED', $result['status']);
        $this->assertEquals(59.98, (float) $result['amount']);
        $this->assertSame($user['id'], (int) $result['user_id']);

        // Verify items
        $stmt = self::$pdo->prepare('SELECT * FROM order_items WHERE order_id = :oid');
        $stmt->execute([':oid' => $order['id']]);
        $items = $stmt->fetchAll();

        $this->assertCount(1, $items);
        $this->assertSame(2, (int) $items[0]['quantity']);
        $this->assertSame(2999, (int) $items[0]['unit_price_cents']);
    }

    // ── Order with user join (getOrder pattern) ───────────────────

    public function testOrderWithCustomerJoin(): void
    {
        $user = $this->createUser([
            'email' => 'buyer@example.com',
            'firstname' => 'Jean',
            'lastname' => 'Dupont',
        ]);
        $order = $this->createOrder($user['id']);

        $stmt = self::$pdo->prepare('
            SELECT o.*, u.firstname, u.lastname
            FROM orders o
            JOIN users u ON u.id = o.user_id
            WHERE o.id = :oid
        ');
        $stmt->execute([':oid' => $order['id']]);
        $result = $stmt->fetch();

        $this->assertSame('Jean', $result['firstname']);
        $this->assertSame('Dupont', $result['lastname']);
    }

    // ── Paginated order listing ───────────────────────────────────

    public function testPaginatedOrdersByStatus(): void
    {
        $user = $this->createUser();

        for ($i = 0; $i < 5; $i++) {
            $this->createOrder($user['id'], ['status' => 'PAYED']);
        }
        $this->createOrder($user['id'], ['status' => 'pending']);

        $stmt = self::$pdo->prepare('SELECT COUNT(*) FROM orders WHERE status = :status');
        $stmt->execute([':status' => 'PAYED']);
        $total = (int) $stmt->fetchColumn();

        $this->assertSame(5, $total);

        $stmt = self::$pdo->prepare('
            SELECT * FROM orders WHERE status = :status
            ORDER BY id LIMIT :limit OFFSET :offset
        ');
        $stmt->bindValue(':status', 'PAYED');
        $stmt->bindValue(':limit', 2, PDO::PARAM_INT);
        $stmt->bindValue(':offset', 0, PDO::PARAM_INT);
        $stmt->execute();
        $page = $stmt->fetchAll();

        $this->assertCount(2, $page);
    }

    // ── User orders listing ───────────────────────────────────────

    public function testUserOrdersIsolated(): void
    {
        $user1 = $this->createUser(['email' => 'user1@test.com']);
        $user2 = $this->createUser(['email' => 'user2@test.com']);

        $this->createOrder($user1['id']);
        $this->createOrder($user1['id']);
        $this->createOrder($user2['id']);

        $stmt = self::$pdo->prepare('SELECT COUNT(*) FROM orders WHERE user_id = :uid');
        $stmt->execute([':uid' => $user1['id']]);

        $this->assertSame(2, (int) $stmt->fetchColumn());
    }

    // ── Order items with product join ─────────────────────────────

    public function testOrderItemProductJoin(): void
    {
        $user = $this->createUser();
        $product = $this->createProduct(['name' => 'Hoodie', 'price' => 5999, 'picture' => 'hoodie.jpg']);
        $order = $this->createOrder($user['id']);

        $productKey = sprintf('%05d', $product['id']) . ' L WHT';
        $this->createOrderItem($order['id'], [
            'product_key' => $productKey,
            'quantity' => 1,
            'unit_price_cents' => 5999,
        ]);

        $stmt = self::$pdo->prepare('
            SELECT oi.*, p.name AS product_name, p.picture
            FROM order_items oi
            JOIN products p ON p.id = CAST(SUBSTRING(oi.product_key FROM 1 FOR 5) AS INTEGER)
            WHERE oi.order_id = :oid
        ');
        $stmt->execute([':oid' => $order['id']]);
        $result = $stmt->fetch();

        $this->assertSame('Hoodie', $result['product_name']);
        $this->assertSame('hoodie.jpg', $result['picture']);
    }

    // ── Cascade delete ────────────────────────────────────────────

    public function testDeleteOrderCascadesItems(): void
    {
        $user = $this->createUser();
        $order = $this->createOrder($user['id']);
        $this->createOrderItem($order['id']);
        $this->createOrderItem($order['id']);

        self::$pdo->prepare('DELETE FROM orders WHERE id = :id')
            ->execute([':id' => $order['id']]);

        $stmt = self::$pdo->prepare('SELECT COUNT(*) FROM order_items WHERE order_id = :oid');
        $stmt->execute([':oid' => $order['id']]);

        $this->assertSame(0, (int) $stmt->fetchColumn());
    }

    // ── Cart to order flow ────────────────────────────────────────

    public function testCartToOrderTransaction(): void
    {
        $user = $this->createUser();
        $p1 = $this->createProduct(['name' => 'Tee', 'price' => 1999]);
        $p2 = $this->createProduct(['name' => 'Cap', 'price' => 1499]);

        // Add to cart
        self::$pdo->prepare('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (:uid, :pid, :qty)')
            ->execute([':uid' => $user['id'], ':pid' => $p1['id'], ':qty' => 2]);
        self::$pdo->prepare('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (:uid, :pid, :qty)')
            ->execute([':uid' => $user['id'], ':pid' => $p2['id'], ':qty' => 1]);

        // Checkout in transaction
        self::$pdo->beginTransaction();

        $stmt = self::$pdo->prepare('
            SELECT ci.product_id, ci.quantity, p.price
            FROM cart_items ci JOIN products p ON p.id = ci.product_id
            WHERE ci.user_id = :uid
        ');
        $stmt->execute([':uid' => $user['id']]);
        $cartItems = $stmt->fetchAll();

        $total = 0;
        foreach ($cartItems as $ci) {
            $total += $ci['price'] * $ci['quantity'];
        }

        $stmt = self::$pdo->prepare('
            INSERT INTO orders (user_id, total_cents, status, created_at)
            VALUES (:uid, :total, :status, NOW())
        ');
        $stmt->execute([':uid' => $user['id'], ':total' => $total, ':status' => 'pending']);
        $orderId = (int) self::$pdo->lastInsertId();

        $stmt = self::$pdo->prepare('
            INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents)
            VALUES (:oid, :pid, :qty, :price)
        ');
        foreach ($cartItems as $ci) {
            $stmt->execute([
                ':oid' => $orderId,
                ':pid' => $ci['product_id'],
                ':qty' => $ci['quantity'],
                ':price' => $ci['price'],
            ]);
        }

        self::$pdo->prepare('DELETE FROM cart_items WHERE user_id = :uid')
            ->execute([':uid' => $user['id']]);

        self::$pdo->commit();

        // Verify order total: (1999*2) + (1499*1) = 5497
        $stmt = self::$pdo->prepare('SELECT total_cents FROM orders WHERE id = :id');
        $stmt->execute([':id' => $orderId]);
        $this->assertSame(5497, (int) $stmt->fetchColumn());

        // Cart is empty
        $stmt = self::$pdo->prepare('SELECT COUNT(*) FROM cart_items WHERE user_id = :uid');
        $stmt->execute([':uid' => $user['id']]);
        $this->assertSame(0, (int) $stmt->fetchColumn());

        // Two order items
        $stmt = self::$pdo->prepare('SELECT COUNT(*) FROM order_items WHERE order_id = :oid');
        $stmt->execute([':oid' => $orderId]);
        $this->assertSame(2, (int) $stmt->fetchColumn());
    }
}
