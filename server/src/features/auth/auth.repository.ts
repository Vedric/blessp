import { prisma } from '../../core/database/client';

export class AuthRepository {
  async createRefreshToken(data: {
    userId: string;
    token: string;
    familyId: string;
    expiresAt: Date;
  }) {
    return prisma.refreshToken.create({
      data: {
        userId: data.userId,
        token: data.token,
        familyId: data.familyId,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findByToken(token: string) {
    return prisma.refreshToken.findUnique({
      where: { token },
    });
  }

  async markAsUsed(id: string) {
    return prisma.refreshToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async revokeFamily(familyId: string) {
    return prisma.refreshToken.deleteMany({
      where: { familyId },
    });
  }

  async findFamilyByToken(token: string) {
    const refreshToken = await prisma.refreshToken.findUnique({
      where: { token },
    });
    if (!refreshToken) return null;

    return { id: refreshToken.familyId };
  }

  async deleteExpired() {
    return prisma.refreshToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
  }

  async deleteByUserId(userId: string) {
    return prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  async createPasswordResetToken(userId: string, token: string, expiresAt: Date) {
    return prisma.passwordResetToken.create({
      data: { userId, token, expiresAt },
    });
  }

  async findPasswordResetToken(token: string) {
    return prisma.passwordResetToken.findFirst({
      where: {
        token,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async markPasswordResetTokenUsed(id: string) {
    return prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async deleteExpiredPasswordResetTokens() {
    return prisma.passwordResetToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
  }
}
