import { prisma } from '../../core/database/client';

const productSelect = {
  id: true,
  name: true,
  price: true,
  picture: true,
  images: true,
  category: true,
  isActive: true,
};

export class WishlistRepository {
  async findByUserId(userId: string) {
    return prisma.wishlistItem.findMany({
      where: { userId },
      include: {
        product: { select: productSelect },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByUserAndProduct(userId: string, productId: string) {
    return prisma.wishlistItem.findUnique({
      where: {
        userId_productId: { userId, productId },
      },
      include: {
        product: { select: productSelect },
      },
    });
  }

  async addItem(userId: string, productId: string) {
    return prisma.wishlistItem.create({
      data: { userId, productId },
      include: {
        product: { select: productSelect },
      },
    });
  }

  async removeByUserAndProduct(userId: string, productId: string) {
    return prisma.wishlistItem.delete({
      where: {
        userId_productId: { userId, productId },
      },
    });
  }
}
