import { NewsletterSubscribeSchema, NewsletterUnsubscribeSchema } from '../../src/features/newsletter/newsletter.schema';

describe('Newsletter public contract (delivery and confirmation tested against PostgreSQL)', () => {
  it.each([undefined, false, 'true'])('rejects subscription without explicit boolean consent: %s', (consent) => {
    expect(NewsletterSubscribeSchema.safeParse({ email: 'alice@example.com', consent }).success).toBe(false);
  });
  it('accepts explicit consent and normalizes email', () => {
    expect(NewsletterSubscribeSchema.parse({ email: 'Alice@Example.com', consent: true })).toEqual({ email: 'alice@example.com', consent: true });
  });
  it('does not allow an email address to authorize unsubscribe', () => {
    expect(NewsletterUnsubscribeSchema.safeParse({ email: 'alice@example.com' }).success).toBe(false);
    expect(NewsletterUnsubscribeSchema.safeParse({ token: 'a'.repeat(64) }).success).toBe(true);
  });
});
