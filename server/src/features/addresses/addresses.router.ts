import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../core/middleware/authenticate';
import { prisma } from '../../core/database/client';
import { transaction, lockResource } from '../../core/database/transaction';
import { NotFoundError } from '../../core/errors/http.errors';
import type { AuthenticatedRequest } from '../../core/types/request.context';
import { sendSuccess, sendCreated, sendNoContent } from '../../core/types/response';

const text = (max: number) => z.string().trim().min(1).max(max);
const AddressSchema = z.object({
  firstName: text(100), lastName: text(100), phone: z.string().trim().max(30).optional(),
  addressLine1: text(200), addressLine2: z.string().trim().max(200).optional(),
  city: text(100), postalCode: text(20), province: z.string().trim().max(100).optional(),
  country: z.string().regex(/^[A-Z]{2}$/), isDefault: z.boolean().optional(),
}).strict();
const router = Router();
router.use(authenticate);
router.get('/', async (req, res) => {
  sendSuccess(res, req, await prisma.address.findMany({ where: { userId: (req as unknown as AuthenticatedRequest).user.userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] }));
});
router.post('/', async (req, res) => {
  const data = AddressSchema.parse(req.body);
  const userId = (req as unknown as AuthenticatedRequest).user.userId;
  const address = await transaction(async (tx) => {
    await lockResource(tx, `addresses:${userId}`);
    const isDefault = data.isDefault || await tx.address.count({ where: { userId } }) === 0;
    if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return tx.address.create({ data: { ...data, userId, isDefault } });
  });
  sendCreated(res, req, address);
});
router.patch('/:id', async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const userId = (req as unknown as AuthenticatedRequest).user.userId;
  const data = AddressSchema.partial().parse(req.body);
  const address = await transaction(async (tx) => {
    await lockResource(tx, `addresses:${userId}`);
    if (!await tx.address.findUnique({ where: { id, userId } })) throw new NotFoundError('Address', id);
    if (data.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return tx.address.update({ where: { id, userId }, data });
  });
  sendSuccess(res, req, address);
});
router.delete('/:id', async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const userId = (req as unknown as AuthenticatedRequest).user.userId;
  await transaction(async (tx) => {
    await lockResource(tx, `addresses:${userId}`);
    const address = await tx.address.findUnique({ where: { id, userId } });
    if (!address) throw new NotFoundError('Address', id);
    await tx.address.delete({ where: { id, userId } });
    if (address.isDefault) {
      const next = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
  sendNoContent(res);
});
export { router as addressesRouter };
