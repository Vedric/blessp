import { prisma } from '../../core/database/client';

export class NewsletterRepository {
  async findByEmail(email: string) {
    return prisma.newsletterSubscription.findUnique({
      where: { email },
    });
  }

  async subscribe(email: string) {
    return prisma.newsletterSubscription.create({
      data: { email },
    });
  }

  async reactivate(email: string) {
    return prisma.newsletterSubscription.update({
      where: { email },
      data: { isActive: true },
    });
  }

  async deactivate(email: string) {
    return prisma.newsletterSubscription.update({
      where: { email },
      data: { isActive: false },
    });
  }
}
