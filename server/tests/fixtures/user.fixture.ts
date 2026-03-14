/**
 * Factory functions for user-related test data.
 */

export interface UserFixture {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

const defaults: UserFixture = {
  id: 'usr_default-0001',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Dupont',
  passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$fakesalt$fakehash',
  isAdmin: false,
  createdAt: new Date('2025-06-01T10:00:00Z'),
  updatedAt: new Date('2025-06-01T10:00:00Z'),
  deletedAt: null,
};

export function makeUserFixture(overrides: Partial<UserFixture> = {}): UserFixture {
  return { ...defaults, ...overrides };
}

export function makeAdminFixture(overrides: Partial<UserFixture> = {}): UserFixture {
  return makeUserFixture({
    id: 'usr_admin-0001',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'Root',
    isAdmin: true,
    ...overrides,
  });
}
