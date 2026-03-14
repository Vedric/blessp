import { NewsletterService } from '@features/newsletter/newsletter.service';
import { NewsletterRepository } from '@features/newsletter/newsletter.repository';

jest.mock('@features/newsletter/newsletter.repository');

describe('NewsletterService', () => {
  let service: NewsletterService;
  let newsletterRepository: jest.Mocked<NewsletterRepository>;

  beforeEach(() => {
    jest.clearAllMocks();

    newsletterRepository = {
      findByEmail: jest.fn(),
      subscribe: jest.fn(),
      reactivate: jest.fn(),
      deactivate: jest.fn(),
    } as unknown as jest.Mocked<NewsletterRepository>;

    service = new NewsletterService(newsletterRepository);
  });

  describe('subscribe', () => {
    const email = 'alice@example.com';

    it('creates a new subscription for a new email', async () => {
      newsletterRepository.findByEmail.mockResolvedValueOnce(null);
      newsletterRepository.subscribe.mockResolvedValueOnce(undefined as any);

      const result = await service.subscribe(email);

      expect(result.alreadySubscribed).toBe(false);
      expect(newsletterRepository.subscribe).toHaveBeenCalledWith(email);
      expect(newsletterRepository.reactivate).not.toHaveBeenCalled();
    });

    it('returns alreadySubscribed true when the email is already active', async () => {
      newsletterRepository.findByEmail.mockResolvedValueOnce({ email, isActive: true } as any);

      const result = await service.subscribe(email);

      expect(result.alreadySubscribed).toBe(true);
      expect(newsletterRepository.subscribe).not.toHaveBeenCalled();
      expect(newsletterRepository.reactivate).not.toHaveBeenCalled();
    });

    it('reactivates a previously unsubscribed email', async () => {
      newsletterRepository.findByEmail.mockResolvedValueOnce({ email, isActive: false } as any);
      newsletterRepository.reactivate.mockResolvedValueOnce(undefined as any);

      const result = await service.subscribe(email);

      expect(result.alreadySubscribed).toBe(false);
      expect(newsletterRepository.reactivate).toHaveBeenCalledWith(email);
      expect(newsletterRepository.subscribe).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribe', () => {
    const email = 'alice@example.com';

    it('deactivates an active subscription', async () => {
      newsletterRepository.findByEmail.mockResolvedValueOnce({ email, isActive: true } as any);
      newsletterRepository.deactivate.mockResolvedValueOnce(undefined as any);

      await service.unsubscribe(email);

      expect(newsletterRepository.deactivate).toHaveBeenCalledWith(email);
    });

    it('does nothing when the email was never subscribed', async () => {
      newsletterRepository.findByEmail.mockResolvedValueOnce(null);

      await service.unsubscribe(email);

      expect(newsletterRepository.deactivate).not.toHaveBeenCalled();
    });

    it('does nothing when the subscription is already inactive', async () => {
      newsletterRepository.findByEmail.mockResolvedValueOnce({ email, isActive: false } as any);

      await service.unsubscribe(email);

      expect(newsletterRepository.deactivate).not.toHaveBeenCalled();
    });
  });
});
