<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;
use Shop\Order;
use Shop\OrderItem;

final class OrderTest extends TestCase
{
    public function testConstructorAssignsAllProperties(): void
    {
        $orderInfos = [
            'id' => 1,
            'order_num' => 'ORD-001',
            'status' => 'PAYED',
            'total' => 99.99,
            'created_at' => '2026-01-15 10:00:00',
        ];
        $customer = [
            'id' => 42,
            'email' => 'alice@example.com',
            'firstname' => 'Alice',
            'lastname' => 'Dupont',
        ];
        $items = [
            new OrderItem('T-Shirt', '00001-M-BLK', 'M', 'Black', 2, 29.99, 'tshirt.jpg'),
            new OrderItem('Hoodie', '00002-L-WHT', 'L', 'White', 1, 59.99, 'hoodie.jpg'),
        ];

        $order = new Order($orderInfos, $customer, $items);

        $this->assertSame($orderInfos, $order->orderInfos);
        $this->assertSame($customer, $order->customer);
        $this->assertSame($items, $order->orderItems);
    }

    public function testConstructorAcceptsEmptyOrderItems(): void
    {
        $order = new Order(['id' => 1], ['id' => 1], []);

        $this->assertEmpty($order->orderItems);
    }

    public function testConstructorAcceptsNullValues(): void
    {
        $order = new Order(null, null, null);

        $this->assertNull($order->orderInfos);
        $this->assertNull($order->customer);
        $this->assertNull($order->orderItems);
    }

    public function testPropertiesArePubliclyAccessible(): void
    {
        $order = new Order([], [], []);

        $order->orderInfos = ['id' => 5];
        $order->customer = ['email' => 'bob@test.com'];
        $order->orderItems = [];

        $this->assertEquals(['id' => 5], $order->orderInfos);
        $this->assertEquals(['email' => 'bob@test.com'], $order->customer);
        $this->assertEmpty($order->orderItems);
    }
}
