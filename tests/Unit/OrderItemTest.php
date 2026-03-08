<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;
use Shop\OrderItem;

final class OrderItemTest extends TestCase
{
    private function makeItem(array $overrides = []): OrderItem
    {
        return new OrderItem(
            $overrides['articleName'] ?? 'Classic T-Shirt',
            $overrides['articleCode'] ?? '00001-M-BLK',
            $overrides['articleSize'] ?? 'M',
            $overrides['articleColor'] ?? 'Black',
            $overrides['qty'] ?? 2,
            $overrides['unitPrice'] ?? 29.99,
            $overrides['picture'] ?? 'tshirt.jpg'
        );
    }

    public function testConstructorAssignsAllProperties(): void
    {
        $item = $this->makeItem();

        $this->assertSame('Classic T-Shirt', $item->articleName);
        $this->assertSame('00001-M-BLK', $item->articleCode);
        $this->assertSame('M', $item->articleSize);
        $this->assertSame('Black', $item->articleColor);
        $this->assertSame(2, $item->qty);
        $this->assertSame(29.99, $item->unitPrice);
        $this->assertSame('tshirt.jpg', $item->picture);
    }

    public function testConstructorWithDifferentSizes(): void
    {
        $sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

        foreach ($sizes as $size) {
            $item = $this->makeItem(['articleSize' => $size]);
            $this->assertSame($size, $item->articleSize);
        }
    }

    public function testConstructorWithZeroQuantity(): void
    {
        $item = $this->makeItem(['qty' => 0]);

        $this->assertSame(0, $item->qty);
    }

    public function testConstructorWithHighUnitPrice(): void
    {
        $item = $this->makeItem(['unitPrice' => 9999.99]);

        $this->assertSame(9999.99, $item->unitPrice);
    }

    public function testPropertiesArePubliclyWritable(): void
    {
        $item = $this->makeItem();

        $item->qty = 5;
        $item->unitPrice = 19.99;

        $this->assertSame(5, $item->qty);
        $this->assertSame(19.99, $item->unitPrice);
    }

    public function testArticleCodeFormat(): void
    {
        // Product key format: sprintf("%05d", id).size.color
        $item = $this->makeItem([
            'articleCode' => '00042-XL-Red',
        ]);

        $this->assertSame('00042-XL-Red', $item->articleCode);
    }
}
