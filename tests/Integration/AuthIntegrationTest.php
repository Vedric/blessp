<?php

declare(strict_types=1);

require_once __DIR__ . '/DatabaseTestCase.php';

final class AuthIntegrationTest extends DatabaseTestCase
{
    // ── User registration ─────────────────────────────────────────

    public function testInsertUserWithValidData(): void
    {
        $email = 'alice@example.com';
        $hash = password_hash('StrongPass1', PASSWORD_DEFAULT);

        $stmt = self::$pdo->prepare('
            INSERT INTO users (email, password_hash, firstname, lastname, created_at)
            VALUES (:email, :hash, :fn, :ln, NOW())
        ');
        $stmt->execute([':email' => $email, ':hash' => $hash, ':fn' => 'Alice', ':ln' => 'Martin']);

        $userId = (int) self::$pdo->lastInsertId();
        $this->assertGreaterThan(0, $userId);

        $stmt = self::$pdo->prepare('SELECT * FROM users WHERE id = :id');
        $stmt->execute([':id' => $userId]);
        $user = $stmt->fetch();

        $this->assertSame($email, $user['email']);
        $this->assertSame('Alice', $user['firstname']);
        $this->assertSame('Martin', $user['lastname']);
        $this->assertFalse((bool) $user['admin']);
    }

    public function testDuplicateEmailRaisesConstraintViolation(): void
    {
        $this->createUser(['email' => 'dup@example.com']);

        $this->expectException(PDOException::class);
        $this->createUser(['email' => 'dup@example.com']);
    }

    public function testPasswordHashVerification(): void
    {
        $plaintext = 'MySecret123';
        $user = $this->createUser([
            'email' => 'verify@example.com',
            'password_hash' => password_hash($plaintext, PASSWORD_DEFAULT),
        ]);

        $stmt = self::$pdo->prepare('SELECT password_hash FROM users WHERE id = :id');
        $stmt->execute([':id' => $user['id']]);
        $row = $stmt->fetch();

        $this->assertTrue(password_verify($plaintext, $row['password_hash']));
        $this->assertFalse(password_verify('WrongPassword', $row['password_hash']));
    }

    // ── Session management ────────────────────────────────────────

    public function testCreateSessionAndLookup(): void
    {
        $user = $this->createUser();
        $session = $this->createSession($user['id'], 'test_token_abc');

        $stmt = self::$pdo->prepare('
            SELECT s.user_id, u.email, u.id, u.firstname, u.lastname, u.admin
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token = :token AND s.expires_at > NOW()
            LIMIT 1
        ');
        $stmt->execute([':token' => 'test_token_abc']);
        $result = $stmt->fetch();

        $this->assertNotFalse($result);
        $this->assertSame($user['id'], (int) $result['id']);
        $this->assertSame($user['email'], $result['email']);
    }

    public function testExpiredSessionNotReturned(): void
    {
        $user = $this->createUser();
        // Create session with -1 second TTL (already expired)
        $token = 'expired_token';
        $stmt = self::$pdo->prepare("
            INSERT INTO sessions (user_id, token, created_at, expires_at)
            VALUES (:uid, :token, NOW(), NOW() - INTERVAL '1 second')
        ");
        $stmt->execute([':uid' => $user['id'], ':token' => $token]);

        $stmt = self::$pdo->prepare('
            SELECT * FROM sessions
            WHERE token = :token AND expires_at > NOW()
        ');
        $stmt->execute([':token' => $token]);

        $this->assertFalse($stmt->fetch());
    }

    public function testDeleteSessionOnLogout(): void
    {
        $user = $this->createUser();
        $session = $this->createSession($user['id'], 'logout_token');

        $stmt = self::$pdo->prepare('DELETE FROM sessions WHERE token = :token');
        $stmt->execute([':token' => 'logout_token']);

        $stmt = self::$pdo->prepare('SELECT * FROM sessions WHERE token = :token');
        $stmt->execute([':token' => 'logout_token']);

        $this->assertFalse($stmt->fetch());
    }

    public function testCascadeDeleteSessionsOnUserDelete(): void
    {
        $user = $this->createUser();
        $this->createSession($user['id']);
        $this->createSession($user['id']);

        self::$pdo->prepare('DELETE FROM users WHERE id = :id')
            ->execute([':id' => $user['id']]);

        $stmt = self::$pdo->prepare('SELECT COUNT(*) FROM sessions WHERE user_id = :uid');
        $stmt->execute([':uid' => $user['id']]);

        $this->assertSame(0, (int) $stmt->fetchColumn());
    }

    // ── Admin flag ────────────────────────────────────────────────

    public function testAdminFlagReturnedInSessionJoin(): void
    {
        $admin = $this->createUser([
            'email' => 'admin@example.com',
            'admin' => true,
        ]);
        $session = $this->createSession($admin['id'], 'admin_token');

        $stmt = self::$pdo->prepare('
            SELECT u.admin FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token = :token AND s.expires_at > NOW()
        ');
        $stmt->execute([':token' => 'admin_token']);
        $result = $stmt->fetch();

        $this->assertTrue((bool) $result['admin']);
    }
}
