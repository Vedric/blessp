import request from 'supertest';
import { app, prisma, setupTestDatabase, cleanDatabase, teardownTestDatabase } from '../helpers/test.setup';
import { registerTestUser } from '../helpers/auth.helper';

const email = 'localized@example.com';
const password = 'LocalizedPassword123!';
async function mail(to: string, path: string) {
  const row = await prisma.emailOutbox.findFirstOrThrow({
    where: { AND: [{ payload: { path: ['to'], equals: to } }, { payload: { path: ['html'], string_contains: path } }] },
    orderBy: { createdAt: 'desc' },
  });
  return row.payload as { html: string; subject: string };
}
function token(payload: { html: string }) { return payload.html.match(/#token=([a-f0-9]{64})/)![1]; }
async function register(locale?: string) {
  await request(app).post('/api/v1/auth/register').send({ email, password, firstName: 'Élodie', lastName: 'Test', locale }).expect(202);
  return mail(email, '/verify-email');
}
beforeAll(setupTestDatabase);
beforeEach(cleanDatabase);
afterAll(teardownTestDatabase);

test.each(['fr', 'en'] as const)('verification and welcome keep the requested language (%s), with a single-use coupon', async locale => {
  const verification = await register(locale);
  expect(verification.html).toContain(`<html lang="${locale}">`);
  expect(verification.html).toContain(`/verify-email?lng=${locale}#token=`);
  expect((await prisma.emailVerificationToken.findFirstOrThrow()).locale).toBe(locale);
  await request(app).post('/api/v1/auth/verify-email').send({ token: token(verification) }).expect(200);
  const welcome = await mail(email, '/shop');
  expect(welcome.html).toContain(`<html lang="${locale}">`);
  expect(welcome.subject).toContain(locale === 'fr' ? 'Bienvenue' : 'Welcome');
  const coupon = await prisma.coupon.findFirstOrThrow();
  expect(welcome.html).toContain(coupon.code); expect(coupon.maxUses).toBe(1);
  await request(app).post('/api/v1/auth/verify-email').send({ token: token(verification) }).expect(401);
  expect(await prisma.emailOutbox.count()).toBe(2); expect(await prisma.coupon.count()).toBe(1);
});

test('resending in another language invalidates the first link and localizes the welcome', async () => {
  const previous = await register('fr');
  await request(app).post('/api/v1/auth/resend-verification').send({ email, locale: 'en' }).expect(200);
  const current = await mail(email, '/verify-email'); expect(current.html).toContain('<html lang="en">');
  expect(token(current)).not.toBe(token(previous));
  await request(app).post('/api/v1/auth/verify-email').send({ token: token(previous) }).expect(401);
  await request(app).post('/api/v1/auth/verify-email').send({ token: token(current) }).expect(200);
  expect((await mail(email, '/shop')).html).toContain('<html lang="en">');
});

test('legacy callers default to English and unsupported locales fail before creating an account', async () => {
  await request(app).post('/api/v1/auth/register').send({ email, password, firstName: 'Test', lastName: 'User', locale: 'xx' }).expect(422);
  expect(await prisma.user.count()).toBe(0); expect(await prisma.emailOutbox.count()).toBe(0);
  expect((await register()).html).toContain('<html lang="en">');
});

test.each(['fr', 'en'] as const)('reset uses the requested language (%s), remains neutral and cannot be reused', async locale => {
  await registerTestUser({ email, password });
  const known = await request(app).post('/api/v1/auth/forgot-password').send({ email, locale }).expect(200);
  const unknown = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'unknown@example.com', locale }).expect(200);
  expect(unknown.body.data).toEqual(known.body.data);
  const reset = await mail(email, '/reset-password'); expect(reset.html).toContain(`<html lang="${locale}">`);
  expect(reset.html).toContain(`/reset-password?lng=${locale}#token=`);
  const nextPassword = 'ChangedPassword123!';
  await request(app).post('/api/v1/auth/reset-password').send({ token: token(reset), password: nextPassword }).expect(200);
  await request(app).post('/api/v1/auth/reset-password').send({ token: token(reset), password }).expect(401);
  await request(app).post('/api/v1/auth/login').send({ email, password: nextPassword }).expect(200);
  expect(await prisma.emailOutbox.count({ where: { payload: { path: ['to'], equals: 'unknown@example.com' } } })).toBe(0);
});

test('changing email in French localizes verification and the old-address security notice', async () => {
  const user = await registerTestUser({ email, password }); const next = 'changed@example.com';
  await request(app).patch('/api/v1/users/profile').set('Authorization', `Bearer ${user.accessToken}`).send({ email: next, currentPassword: password, locale: 'fr' }).expect(200);
  const verification = await mail(next, '/verify-email'); expect(verification.html).toContain('<html lang="fr">');
  expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(email);
  await request(app).post('/api/v1/auth/verify-email').send({ token: token(verification) }).expect(200);
  const notice = await mail(email, '/contact'); expect(notice.html).toContain('<html lang="fr">'); expect(notice.subject).toContain('Adresse e-mail modifiée');
  expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(next);
});
