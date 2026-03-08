<?php

declare(strict_types=1);

require_once __DIR__ . '/DatabaseTestCase.php';

final class ProductIntegrationTest extends DatabaseTestCase
{
    // ── Product listing ───────────────────────────────────────────

    public function testListAllProducts(): void
    {
        $this->createProduct(['name' => 'Product A']);
        $this->createProduct(['name' => 'Product B']);
        $this->createProduct(['name' => 'Product C', 'active' => false]);

        $stmt = self::$pdo->query('SELECT COUNT(*) FROM products');
        $this->assertSame(3, (int) $stmt->fetchColumn());
    }

    public function testListActiveProductsOnly(): void
    {
        $this->createProduct(['name' => 'Active 1', 'active' => true]);
        $this->createProduct(['name' => 'Active 2', 'active' => true]);
        $this->createProduct(['name' => 'Inactive', 'active' => false]);

        $stmt = self::$pdo->query('SELECT COUNT(*) FROM products WHERE active IS TRUE');
        $this->assertSame(2, (int) $stmt->fetchColumn());
    }

    public function testPaginatedProductQuery(): void
    {
        for ($i = 1; $i <= 25; $i++) {
            $this->createProduct(['name' => "Product {$i}"]);
        }

        $perPage = 10;
        $offset = 0;

        $stmt = self::$pdo->prepare('
            SELECT p.id, p.name, p.price, p.picture, p.category, p.active
            FROM products AS p
            ORDER BY p.id LIMIT :limit OFFSET :offset
        ');
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $page1 = $stmt->fetchAll();

        $this->assertCount(10, $page1);
        $this->assertSame('Product 1', $page1[0]['name']);
        $this->assertSame('Product 10', $page1[9]['name']);
    }

    // ── Single product lookup ─────────────────────────────────────

    public function testGetProductById(): void
    {
        $product = $this->createProduct([
            'name' => 'Hoodie Premium',
            'price' => 7999,
            'category' => '[hoodie]',
            'details' => 'Premium quality',
        ]);

        $stmt = self::$pdo->prepare('
            SELECT p.id, p.name, p.price, p.picture, p.category, p.details, p.active, p.secondary_pictures, p.colors
            FROM products AS p WHERE p.id = :id
        ');
        $stmt->execute([':id' => $product['id']]);
        $result = $stmt->fetch();

        $this->assertSame('Hoodie Premium', $result['name']);
        $this->assertSame(7999, (int) $result['price']);
        $this->assertSame('[hoodie]', $result['category']);
    }

    public function testGetProductMinimalFields(): void
    {
        $product = $this->createProduct([
            'name' => 'Basic Tee',
            'price' => 1999,
        ]);

        $stmt = self::$pdo->prepare('SELECT p.id, p.name, p.price FROM products AS p WHERE p.id = :id');
        $stmt->execute([':id' => $product['id']]);
        $result = $stmt->fetch();

        $this->assertCount(3, $result);
        $this->assertSame('Basic Tee', $result['name']);
    }

    public function testNonExistentProductReturnsEmpty(): void
    {
        $stmt = self::$pdo->prepare('SELECT * FROM products WHERE id = :id');
        $stmt->execute([':id' => 99999]);

        $this->assertFalse($stmt->fetch());
    }

    // ── Featured products ─────────────────────────────────────────

    public function testFeaturedProductsQuery(): void
    {
        $this->createProduct(['name' => 'Not Featured']);
        $p1 = $this->createProduct(['name' => 'Featured 2']);
        $p2 = $this->createProduct(['name' => 'Featured 1']);

        self::$pdo->exec("UPDATE products SET onfront_order = 2 WHERE id = {$p1['id']}");
        self::$pdo->exec("UPDATE products SET onfront_order = 1 WHERE id = {$p2['id']}");

        $stmt = self::$pdo->query('
            SELECT * FROM products
            WHERE active IS TRUE AND onfront_order IS NOT NULL AND onfront_order > 0
            ORDER BY onfront_order ASC
        ');
        $results = $stmt->fetchAll();

        $this->assertCount(2, $results);
        $this->assertSame('Featured 1', $results[0]['name']);
        $this->assertSame('Featured 2', $results[1]['name']);
    }

    // ── Price stored as integer (cents) ───────────────────────────

    public function testPriceStoredAsCents(): void
    {
        $product = $this->createProduct(['name' => 'Cap', 'price' => 1499]);

        $stmt = self::$pdo->prepare('SELECT price FROM products WHERE id = :id');
        $stmt->execute([':id' => $product['id']]);
        $price = (int) $stmt->fetchColumn();

        $this->assertSame(1499, $price);
        // $14.99 in display
        $this->assertSame('14.99', number_format($price / 100, 2, '.', ''));
    }
}
