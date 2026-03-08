<?php

declare(strict_types=1);

require_once __DIR__ . '/DatabaseTestCase.php';

final class AddressIntegrationTest extends DatabaseTestCase
{
    // ── Address CRUD ──────────────────────────────────────────────

    public function testCreateAddress(): void
    {
        $user = $this->createUser();
        $addr = $this->createAddress($user['id'], [
            'firstname' => 'Alice',
            'address' => '42 Rue Sherbrooke',
            'city' => 'Montreal',
            'postal_code' => 'H2X 1Y4',
            'country' => 'CA',
        ]);

        $stmt = self::$pdo->prepare('SELECT * FROM account_addresses WHERE id = :id');
        $stmt->execute([':id' => $addr['id']]);
        $result = $stmt->fetch();

        $this->assertSame('Alice', $result['firstname']);
        $this->assertSame('42 Rue Sherbrooke', $result['address']);
        $this->assertSame('Montreal', $result['city']);
        $this->assertSame('CA', $result['country']);
    }

    public function testListUserAddresses(): void
    {
        $user = $this->createUser();
        $this->createAddress($user['id'], ['address' => '1 First St']);
        $this->createAddress($user['id'], ['address' => '2 Second St']);
        $this->createAddress($user['id'], ['address' => '3 Third St', 'default_address' => true]);

        $stmt = self::$pdo->prepare('
            SELECT * FROM account_addresses
            WHERE user_id = :uid
            ORDER BY default_address DESC, id ASC
        ');
        $stmt->execute([':uid' => $user['id']]);
        $addresses = $stmt->fetchAll();

        $this->assertCount(3, $addresses);
        // Default address comes first
        $this->assertSame('3 Third St', $addresses[0]['address']);
    }

    public function testUpdateAddress(): void
    {
        $user = $this->createUser();
        $addr = $this->createAddress($user['id']);

        $stmt = self::$pdo->prepare('
            UPDATE account_addresses
            SET firstname = :fn, lastname = :ln, address = :addr, city = :city,
                postal_code = :pc, country = :country
            WHERE user_id = :uid AND id = :id
        ');
        $stmt->execute([
            ':fn' => 'Updated',
            ':ln' => 'Name',
            ':addr' => '999 New St',
            ':city' => 'Toronto',
            ':pc' => 'M5H 2N2',
            ':country' => 'CA',
            ':uid' => $user['id'],
            ':id' => $addr['id'],
        ]);

        $stmt = self::$pdo->prepare('SELECT * FROM account_addresses WHERE id = :id');
        $stmt->execute([':id' => $addr['id']]);
        $result = $stmt->fetch();

        $this->assertSame('Updated', $result['firstname']);
        $this->assertSame('999 New St', $result['address']);
        $this->assertSame('Toronto', $result['city']);
    }

    public function testDeleteAddress(): void
    {
        $user = $this->createUser();
        $addr = $this->createAddress($user['id']);

        $stmt = self::$pdo->prepare('DELETE FROM account_addresses WHERE user_id = :uid AND id = :id');
        $stmt->execute([':uid' => $user['id'], ':id' => $addr['id']]);

        $stmt = self::$pdo->prepare('SELECT COUNT(*) FROM account_addresses WHERE id = :id');
        $stmt->execute([':id' => $addr['id']]);

        $this->assertSame(0, (int) $stmt->fetchColumn());
    }

    // ── Default address toggle ────────────────────────────────────

    public function testSetDefaultAddressClearsOthers(): void
    {
        $user = $this->createUser();
        $a1 = $this->createAddress($user['id'], ['default_address' => true]);
        $a2 = $this->createAddress($user['id']);

        // Set a2 as default (same pattern as saveAddress)
        self::$pdo->prepare('UPDATE account_addresses SET default_address = FALSE WHERE user_id = :uid')
            ->execute([':uid' => $user['id']]);
        self::$pdo->prepare('UPDATE account_addresses SET default_address = TRUE WHERE user_id = :uid AND id = :id')
            ->execute([':uid' => $user['id'], ':id' => $a2['id']]);

        // Verify
        $stmt = self::$pdo->prepare('SELECT default_address FROM account_addresses WHERE id = :id');

        $stmt->execute([':id' => $a1['id']]);
        $this->assertFalse((bool) $stmt->fetchColumn());

        $stmt->execute([':id' => $a2['id']]);
        $this->assertTrue((bool) $stmt->fetchColumn());
    }

    // ── Ownership isolation ───────────────────────────────────────

    public function testAddressesIsolatedByUser(): void
    {
        $user1 = $this->createUser(['email' => 'u1@test.com']);
        $user2 = $this->createUser(['email' => 'u2@test.com']);

        $this->createAddress($user1['id']);
        $this->createAddress($user1['id']);
        $this->createAddress($user2['id']);

        $stmt = self::$pdo->prepare('SELECT COUNT(*) FROM account_addresses WHERE user_id = :uid');
        $stmt->execute([':uid' => $user1['id']]);

        $this->assertSame(2, (int) $stmt->fetchColumn());
    }

    public function testCannotUpdateOtherUsersAddress(): void
    {
        $user1 = $this->createUser(['email' => 'owner@test.com']);
        $user2 = $this->createUser(['email' => 'attacker@test.com']);
        $addr = $this->createAddress($user1['id']);

        // user2 tries to update user1's address
        $stmt = self::$pdo->prepare('
            UPDATE account_addresses SET city = :city
            WHERE user_id = :uid AND id = :id
        ');
        $stmt->execute([':city' => 'Hacked', ':uid' => $user2['id'], ':id' => $addr['id']]);

        // Address should be unchanged
        $stmt = self::$pdo->prepare('SELECT city FROM account_addresses WHERE id = :id');
        $stmt->execute([':id' => $addr['id']]);

        $this->assertSame('Montreal', $stmt->fetchColumn());
    }

    // ── Cascade on user delete ────────────────────────────────────

    public function testDeleteUserCascadesAddresses(): void
    {
        $user = $this->createUser();
        $this->createAddress($user['id']);
        $this->createAddress($user['id']);

        self::$pdo->prepare('DELETE FROM users WHERE id = :id')
            ->execute([':id' => $user['id']]);

        $stmt = self::$pdo->prepare('SELECT COUNT(*) FROM account_addresses WHERE user_id = :uid');
        $stmt->execute([':uid' => $user['id']]);

        $this->assertSame(0, (int) $stmt->fetchColumn());
    }
}
