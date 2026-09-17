import { transaction, lockResource } from '../../core/database/transaction';
import { UnauthorizedError } from '../../core/errors/http.errors';
import { enqueueEmail } from '../../core/email/outbox';
import type { EmailPayload } from '../../core/email/email.service';
import { hashToken } from '../../core/security/secrets';
import { prisma } from '../../core/database/client';

export class AuthRepository {
  async createRefreshToken(data: {
    userId: string;
    token: string;
    familyId: string;
    expiresAt: Date;
    sessionVersion: number;
  }) {
    return transaction(async (tx) => {
      await lockResource(tx, `session:${data.userId}`);
      const user = await tx.user.findUnique({ where: { id: data.userId, deletedAt: null } });
      if (!user || user.sessionVersion !== data.sessionVersion) throw new UnauthorizedError('Account security changed. Sign in again.');
      return tx.refreshToken.create({
      data: {
        userId: data.userId,
        token: hashToken(data.token),
        familyId: data.familyId,
        expiresAt: data.expiresAt,
      },
      });
    });
  }

  async findByToken(token: string) {
    return prisma.refreshToken.findUnique({
      where: { token: hashToken(token) },
    });
  }

  async markAsUsed(id: string) {
    return prisma.refreshToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async revokeFamily(familyId: string) {
    const token = await prisma.refreshToken.findFirst({ where: { familyId } });
    if (!token) return;
    return transaction(async (tx) => {
      await lockResource(tx, `session:${token.userId}`);
      return tx.refreshToken.deleteMany({ where: { familyId } });
    });
  }

  async findFamilyByToken(token: string) {
    const refreshToken = await prisma.refreshToken.findUnique({
      where: { token: hashToken(token) },
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

  async createPasswordResetToken(userId: string, token: string, expiresAt: Date, email: EmailPayload) {
    return transaction(async (tx) => {
      await lockResource(tx, `session:${userId}`);
      await tx.passwordResetToken.deleteMany({ where: { userId } });
      const result = await tx.passwordResetToken.create({ data: { userId, token: hashToken(token), expiresAt } });
      await enqueueEmail(tx, email);
      return result;
    });
  }

  async findPasswordResetToken(token: string) {
    return prisma.passwordResetToken.findFirst({
      where: {
        token: hashToken(token),
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
