import { NewsletterRepository } from './newsletter.repository';

export interface SubscribeResult {
  alreadySubscribed: boolean;
}

export class NewsletterService {
  constructor(private readonly newsletterRepository: NewsletterRepository) {}

  async subscribe(email: string): Promise<SubscribeResult> {
    const existing = await this.newsletterRepository.findByEmail(email);

    if (existing && existing.isActive) {
      return { alreadySubscribed: true };
    }

    if (existing && !existing.isActive) {
      // Re-subscribe a previously unsubscribed email
      await this.newsletterRepository.reactivate(email);
      return { alreadySubscribed: false };
    }

    await this.newsletterRepository.subscribe(email);
    return { alreadySubscribed: false };
  }

  async unsubscribe(email: string): Promise<void> {
    const existing = await this.newsletterRepository.findByEmail(email);

    // Silently succeed if the email was never subscribed or already inactive
    if (!existing || !existing.isActive) {
      return;
    }

    await this.newsletterRepository.deactivate(email);
  }
}
