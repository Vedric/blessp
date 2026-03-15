import request from 'supertest';
import {
  app,
  isDatabaseAvailable,
  setupTestDatabase,
  cleanDatabase,
  teardownTestDatabase,
} from '../helpers/test.setup';

let dbAvailable = false;

beforeAll(async () => {
  dbAvailable = await isDatabaseAvailable();
  if (dbAvailable) {
    await setupTestDatabase();
  }
});

afterEach(async () => {
  if (dbAvailable) {
    await cleanDatabase();
  }
});

afterAll(async () => {
  if (dbAvailable) {
    await teardownTestDatabase();
  }
});

describe('Contact API integration tests', () => {
  describe('POST /api/v1/contact', () => {
    it('accepts a valid contact submission and returns 201', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .post('/api/v1/contact')
        .send({
          name: 'Alice Dupont',
          email: 'alice@example.com',
          subject: 'Order inquiry',
          message: 'I have a question about my recent order, could you help me please?',
        })
        .expect(201);

      expect(res.body.data).toBeDefined();
      expect(res.body.meta).toBeDefined();
    });

    it('returns 422 when the name is missing', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .post('/api/v1/contact')
        .send({
          email: 'noname@example.com',
          subject: 'Missing name',
          message: 'This submission is missing the name field entirely.',
        })
        .expect(422);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 422 when the email is invalid', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .post('/api/v1/contact')
        .send({
          name: 'Alice',
          email: 'not-an-email',
          subject: 'Bad email',
          message: 'This submission has an invalid email address format.',
        })
        .expect(422);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 422 when the message is too short', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .post('/api/v1/contact')
        .send({
          name: 'Alice',
          email: 'alice@example.com',
          subject: 'Short message',
          message: 'Too short',
        })
        .expect(422);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 422 when the body is empty', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .post('/api/v1/contact')
        .send({})
        .expect(422);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 422 when extra fields are included (strict mode)', async () => {
      if (!dbAvailable) return;

      const res = await request(app)
        .post('/api/v1/contact')
        .send({
          name: 'Alice',
          email: 'alice@example.com',
          subject: 'Extra fields test',
          message: 'This submission includes an extra field that should be rejected.',
          phone: '+33612345678',
        })
        .expect(422);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('does not require authentication', async () => {
      if (!dbAvailable) return;

      // A valid submission with no Authorization header should succeed
      const res = await request(app)
        .post('/api/v1/contact')
        .send({
          name: 'Public User',
          email: 'public@example.com',
          subject: 'Public contact form',
          message: 'This form should be accessible without any authentication token.',
        })
        .expect(201);

      expect(res.body.data).toBeDefined();
    });
  });
});
