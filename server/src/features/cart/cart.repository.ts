import { prisma } from '../../core/database/client';
import { AddToCartDto } from './cart.types';

export class CartRepository {
  async findByUserId(userId: string) {
    return prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            picture: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findItemById(itemId: string) {
    return prisma.cartItem.findUnique({
      where: { id: itemId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            picture: true,
            isActive: true,
          },
        },
      },
    });
  }

  async addItem(userId: string, dto: AddToCartDto) {
    // Upsert: if the same product with same size and color exists, update quantity
    return prisma.cartItem.upsert({
      where: {
        userId_productId_size_color: {
          userId,
          productId: dto.productId,
          size: dto.size ?? '',
          color: dto.color ?? '',
        },
      },
      update: {
        quantity: { increment: dto.quantity },
      },
      create: {
        userId,
        productId: dto.productId,
        quantity: dto.quantity,
        size: dto.size ?? null,
        color: dto.color ?? null,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            picture: true,
            isActive: true,
          },
        },
      },
    });
  }

  async updateQuantity(itemId: string, quantity: number) {
    return prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            picture: true,
            isActive: true,
          },
        },
      },
    });
  }

  async removeItem(itemId: string) {
    return prisma.cartItem.delete({
      where: { id: itemId },
    });
  }

  async clearCart(userId: string) {
    return prisma.cartItem.deleteMany({
      where: { userId },
    });
  }
}
