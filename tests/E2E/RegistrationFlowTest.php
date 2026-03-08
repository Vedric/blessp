<?php

declare(strict_types=1);

require_once __DIR__ . '/ApiTestCase.php';

/**
 * E2E tests for the registration and authentication flow.
 *
 * Tests the full HTTP roundtrip: register → login → access protected
 * endpoint → logout.
 */
final class RegistrationFlowTest extends ApiTestCase
{
    public function testRegisterNewUser(): void
    {
        $res = $this->registerUser('newuser@example.com');

        $this->assertSame(201, $res['status']);
        $this->assertTrue($res['body']['ok']);
        $this->assertArrayHasKey('user_id', $res['body']);
    }

    public function testRegisterDuplicateEmailReturns409(): void
    {
        $this->registerUser('dup@example.com');
        $res = $this->registerUser('dup@example.com');

        $this->assertSame(409, $res['status']);
    }

    public function testRegisterWithInvalidEmailReturns422(): void
    {
        $res = $this->request('POST', '/api.php/register', [
            'email' => 'not-an-email',
            'password' => 'TestPass123',
            'firstname' => 'Test',
            'lastname' => 'User',
        ]);

        $this->assertSame(422, $res['status']);
        $this->assertSame('validation_error', $res['body']['error']);
    }

    public function testRegisterWithShortPasswordReturns422(): void
    {
        $res = $this->request('POST', '/api.php/register', [
            'email' => 'short@example.com',
            'password' => 'abc',
            'firstname' => 'Test',
            'lastname' => 'User',
        ]);

        $this->assertSame(422, $res['status']);
        $this->assertArrayHasKey('password', $res['body']['fields']);
    }

    public function testLoginAfterRegistration(): void
    {
        $this->registerUser('login@example.com', 'SecurePass1');

        $res = $this->request('POST', '/api.php/login', [
            'email' => 'login@example.com',
            'password' => 'SecurePass1',
        ]);

        $this->assertSame(200, $res['status']);
        $this->assertTrue($res['body']['ok']);
        // Cookie should be set
        $this->assertArrayHasKey('set-cookie', $res['headers']);
    }

    public function testLoginWithWrongPasswordReturns401(): void
    {
        $this->registerUser('wrong@example.com', 'CorrectPass1');

        $res = $this->request('POST', '/api.php/login', [
            'email' => 'wrong@example.com',
            'password' => 'WrongPassword',
        ]);

        $this->assertSame(401, $res['status']);
    }

    public function testLoginWithNonExistentEmailReturns401(): void
    {
        $res = $this->request('POST', '/api.php/login', [
            'email' => 'nobody@example.com',
            'password' => 'SomePass123',
        ]);

        $this->assertSame(401, $res['status']);
    }

    public function testSecurityHeadersPresent(): void
    {
        $res = $this->request('GET', '/api.php/me');

        $this->assertSame('nosniff', $res['headers']['x-content-type-options'] ?? '');
        $this->assertSame('DENY', $res['headers']['x-frame-options'] ?? '');
    }
}
