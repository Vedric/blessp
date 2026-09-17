import request from 'supertest';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { app, prisma, setupTestDatabase, cleanDatabase, teardownTestDatabase } from '../helpers/test.setup';
import { Env } from '../../src/core/config/env';
import { registerTestUser } from '../helpers/auth.helper';
import { MfaService } from '../../src/features/auth/mfa.service';

const mockKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
jest.mock('jwks-rsa', () => ({ __esModule: true, default: () => ({ getSigningKey: (_kid: string, cb: (err: null, key: { getPublicKey: () => string }) => void) => cb(null, { getPublicKey: () => mockKeys.publicKey }) }) }));
const googleIdentity = { aud: 'social-google-test', sub: 'google-subject', email: 'social-google@example.com', email_verified: 'true', exp: '9999999999' };
const googleProfile = { sub: googleIdentity.sub, email: googleIdentity.email, given_name: 'Google', family_name: 'Tester' };
function google(identity = googleIdentity, profile = googleProfile) {
  jest.spyOn(global, 'fetch').mockImplementation(async input => ({ ok: true, json: async () => ({ ...(String(input).includes('tokeninfo') ? identity : profile) }) }) as Response);
}
function apple(overrides = {}, options: jwt.SignOptions = {}) {
  return jwt.sign({ sub: 'apple-subject', email: 'social-apple@example.com', email_verified: true, ...overrides }, mockKeys.privateKey, { algorithm: 'RS256', keyid: 'synthetic-key', issuer: 'https://appleid.apple.com', audience: 'social-apple-test', expiresIn: '5m', ...options });
}
beforeAll(setupTestDatabase);
beforeEach(async () => { await cleanDatabase(); Env.GOOGLE_CLIENT_ID = 'social-google-test'; Env.APPLE_CLIENT_ID = 'social-apple-test'; });
afterEach(() => jest.restoreAllMocks());
afterAll(teardownTestDatabase);

test('Google creates a verified account from bound userinfo, logs in again and refreshes a real session', async () => {
  google();
  const first = await request(app).post('/api/v1/auth/google').send({ idToken: 'synthetic-token' }).expect(200);
  expect(first.body.data.user).toMatchObject({ firstName: 'Google', lastName: 'Tester', email: googleIdentity.email });
  const token = first.body.data.tokens.accessToken;
  await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  const second = await request(app).post('/api/v1/auth/google').send({ idToken: 'synthetic-token' }).expect(200);
  expect(second.body.data.user.id).toBe(first.body.data.user.id); expect(await prisma.user.count()).toBe(1);
  await request(app).post('/api/v1/auth/refresh').set('Cookie', first.headers['set-cookie']).expect(200);
});
test.each(['expired', 'audience', 'unverified', 'profile'])('Google rejects %s identity without creating a session', async mode => {
  google({ ...googleIdentity, ...(mode === 'expired' ? { exp: '1' } : mode === 'audience' ? { aud: 'another-app' } : mode === 'unverified' ? { email_verified: 'false' } : {}) }, { ...googleProfile, ...(mode === 'profile' ? { sub: 'other-person' } : {}) });
  await request(app).post('/api/v1/auth/google').send({ idToken: 'synthetic-token' }).expect(401);
  expect(await prisma.user.count()).toBe(0); expect(await prisma.session.count()).toBe(0);
});
test('Google profile completion cannot replace a verified email or grant admin', async () => {
  google(googleIdentity, { ...googleProfile, given_name: '', family_name: '' });
  const missing = await request(app).post('/api/v1/auth/google').send({ idToken: 'synthetic' }).expect(422); expect(missing.body.error.code).toBe('PROFILE_REQUIRED');
  await request(app).post('/api/v1/auth/google').send({ idToken: 'synthetic', firstName: 'Real', lastName: 'Name', email: 'attacker@example.com', isAdmin: true }).expect(422);
  const complete = await request(app).post('/api/v1/auth/google').send({ idToken: 'synthetic', firstName: 'Real', lastName: 'Name' }).expect(200);
  expect(complete.body.data.user).toMatchObject({ email: googleIdentity.email, firstName: 'Real', isAdmin: false });
});
test('matching email never silently links Google to an existing password account', async () => {
  await registerTestUser({ email: googleIdentity.email }); google();
  await request(app).post('/api/v1/auth/google').send({ idToken: 'synthetic' }).expect(401);
  expect(await prisma.oAuthAccount.count()).toBe(0);
});
test('Apple verifies a real RSA signature and supports missing names on subsequent sign-in', async () => {
  const first = await request(app).post('/api/v1/auth/apple').send({ idToken: apple(), firstName: 'Apple', lastName: 'Tester' }).expect(200);
  const second = await request(app).post('/api/v1/auth/apple').send({ idToken: apple() }).expect(200);
  expect(second.body.data.user.id).toBe(first.body.data.user.id); expect(await prisma.user.count()).toBe(1);
});
test('Apple allows explicit profile completion when the first name response was lost', async () => {
  const missing = await request(app).post('/api/v1/auth/apple').send({ idToken: apple() }).expect(422); expect(missing.body.error.code).toBe('PROFILE_REQUIRED');
  await request(app).post('/api/v1/auth/apple').send({ idToken: apple(), firstName: 'Apple', lastName: 'Tester' }).expect(200);
});
test.each(['signature', 'issuer', 'audience', 'expiry', 'unverified'])('Apple rejects invalid %s', async mode => {
  let token = apple(mode === 'unverified' ? { email_verified: false } : {}, mode === 'issuer' ? { issuer: 'https://attacker.invalid' } : mode === 'audience' ? { audience: 'other-app' } : mode === 'expiry' ? { expiresIn: -1 } : {});
  if (mode === 'signature') token = token.slice(0, -8) + 'tampered';
  await request(app).post('/api/v1/auth/apple').send({ idToken: token, firstName: 'Fake', lastName: 'Identity' }).expect(401);
  expect(await prisma.user.count()).toBe(0);
});
test('social sign-in enforces MFA and refuses a deactivated account', async () => {
  google(); const first = await request(app).post('/api/v1/auth/google').send({ idToken: 'synthetic' }).expect(200);
  const enabled = jest.spyOn(MfaService.prototype, 'isEnabled').mockResolvedValue(true);
  const check = jest.spyOn(MfaService.prototype, 'checkCode').mockResolvedValue(false);
  const challenged = await request(app).post('/api/v1/auth/google').send({ idToken: 'synthetic' }).expect(401); expect(challenged.body.error.code).toBe('MFA_REQUIRED');
  await request(app).post('/api/v1/auth/google').send({ idToken: 'synthetic', mfaToken: '000000' }).expect(401);
  check.mockResolvedValue(true); await request(app).post('/api/v1/auth/google').send({ idToken: 'synthetic', mfaToken: '123456' }).expect(200);
  enabled.mockRestore(); check.mockRestore();
  await prisma.user.update({ where: { id: first.body.data.user.id }, data: { deletedAt: new Date() } });
  await request(app).post('/api/v1/auth/google').send({ idToken: 'synthetic' }).expect(401);
});
