<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class PaginationTest extends TestCase
{
    protected function setUp(): void
    {
        // Reset $_GET before each test
        $_GET = [];
    }

    // ── getPaginationParams ───────────────────────────────────────

    public function testDefaultPaginationValues(): void
    {
        $params = getPaginationParams();

        $this->assertSame(1, $params['page']);
        $this->assertSame(20, $params['perPage']);
        $this->assertSame(0, $params['offset']);
    }

    public function testCustomPageAndPerPage(): void
    {
        $_GET['page'] = '3';
        $_GET['perPage'] = '10';

        $params = getPaginationParams();

        $this->assertSame(3, $params['page']);
        $this->assertSame(10, $params['perPage']);
        $this->assertSame(20, $params['offset']); // (3-1) * 10
    }

    public function testPageBelowOneClampedToOne(): void
    {
        $_GET['page'] = '0';
        $params = getPaginationParams();
        $this->assertSame(1, $params['page']);

        $_GET['page'] = '-5';
        $params = getPaginationParams();
        $this->assertSame(1, $params['page']);
    }

    public function testPerPageClampedToMinimumOne(): void
    {
        $_GET['perPage'] = '0';
        $params = getPaginationParams();
        $this->assertSame(1, $params['perPage']);

        $_GET['perPage'] = '-10';
        $params = getPaginationParams();
        $this->assertSame(1, $params['perPage']);
    }

    public function testPerPageClampedToMaximumHundred(): void
    {
        $_GET['perPage'] = '200';
        $params = getPaginationParams();
        $this->assertSame(100, $params['perPage']);

        $_GET['perPage'] = '101';
        $params = getPaginationParams();
        $this->assertSame(100, $params['perPage']);
    }

    public function testPerPageAtBoundaryValues(): void
    {
        $_GET['perPage'] = '1';
        $params = getPaginationParams();
        $this->assertSame(1, $params['perPage']);

        $_GET['perPage'] = '100';
        $params = getPaginationParams();
        $this->assertSame(100, $params['perPage']);
    }

    public function testOffsetCalculation(): void
    {
        $_GET['page'] = '1';
        $_GET['perPage'] = '20';
        $this->assertSame(0, getPaginationParams()['offset']);

        $_GET['page'] = '2';
        $_GET['perPage'] = '20';
        $this->assertSame(20, getPaginationParams()['offset']);

        $_GET['page'] = '5';
        $_GET['perPage'] = '50';
        $this->assertSame(200, getPaginationParams()['offset']);
    }

    public function testNonNumericInputDefaultsGracefully(): void
    {
        $_GET['page'] = 'abc';
        $_GET['perPage'] = 'xyz';

        $params = getPaginationParams();

        // (int)'abc' = 0, clamped to 1
        $this->assertSame(1, $params['page']);
        // (int)'xyz' = 0, clamped to 1
        $this->assertSame(1, $params['perPage']);
    }
}
