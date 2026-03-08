<?php

declare(strict_types=1);

require_once __DIR__ . '/ApiTestCase.php';

/**
 * E2E tests for product endpoints.
 */
final class ProductFlowTest extends ApiTestCase
{
    public function testGetActiveProductsPaginated(): void
    {
        // Seed products directly via DB
        for ($i = 1; $i <= 5; $i++) {
            $this->createProduct(['name' => "E2E Product {$i}", 'active' => true]);
        }
        $this->createProduct(['name' => 'Inactive', 'active' => false]);

        $res = $this->request('GET', '/api.php/active_products?page=1&perPage=3');

        $this->assertSame(200, $res['status']);
        $this->assertCount(3, $res['body']['data']);
        $this->assertSame(5, $res['body']['pagination']['totalItems']);
        $this->assertSame(2, $res['body']['pagination']['totalPages']);
    }

    public function testGetAllProductsPaginated(): void
    {
        for ($i = 1; $i <= 3; $i++) {
            $this->createProduct(['name' => "Product {$i}"]);
        }

        $res = $this->request('GET', '/api.php/products');

        $this->assertSame(200, $res['status']);
        $this->assertCount(3, $res['body']['data']);
    }

    public function testGetSingleProduct(): void
    {
        $product = $this->createProduct([
            'name' => 'Test Hoodie',
            'price' => 4999,
            'category' => '[hoodie]',
        ]);

        $res = $this->request('GET', '/api.php/product?id=' . $product['id']);

        $this->assertSame(200, $res['status']);
        $this->assertSame('Test Hoodie', $res['body'][0]['name']);
    }

    public function testGetProductWithoutIdReturns400(): void
    {
        $res = $this->request('GET', '/api.php/product');

        $this->assertSame(400, $res['status']);
    }

    public function testGetProductMinimal(): void
    {
        $product = $this->createProduct(['name' => 'Minimal', 'price' => 999]);

        $res = $this->request('GET', '/api.php/product_min?id=' . $product['id']);

        $this->assertSame(200, $res['status']);
        $this->assertCount(3, $res['body'][0]); // id, name, price only
    }
}
