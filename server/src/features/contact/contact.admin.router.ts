import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../core/database/client';
import { authenticate } from '../../core/middleware/authenticate';
import { authorizeAdmin } from '../../core/middleware/authorize';
import { sendSuccess } from '../../core/types/response';
import { NotFoundError } from '../../core/errors/http.errors';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['all', 'unread', 'read']).default('unread'),
  search: z.string().trim().max(100).default(''),
});
const router = Router();
router.use(authenticate, authorizeAdmin);
router.get('/', async (req, res, next) => {
  try {
    const { page, perPage, status, search } = querySchema.parse(req.query);
    const where: Prisma.ContactMessageWhereInput = {
      ...(status === 'unread' ? { readAt: null } : status === 'read' ? { readAt: { not: null } } : {}),
      ...(search ? { OR: ['name', 'email', 'subject'].map(field => ({ [field]: { contains: search, mode: 'insensitive' } })) } : {}),
    };
    const [items, totalItems, unread] = await prisma.$transaction([
      prisma.contactMessage.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * perPage, take: perPage }),
      prisma.contactMessage.count({ where }),
      prisma.contactMessage.count({ where: { readAt: null } }),
    ]);
    res.setHeader('Cache-Control', 'no-store');
    sendSuccess(res, req, { items, unread, pagination: { page, perPage, totalItems, totalPages: Math.ceil(totalItems / perPage) } });
  } catch (error) { next(error); }
});
router.patch('/:id', async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const { read } = z.object({ read: z.boolean() }).strict().parse(req.body);
    await prisma.contactMessage.updateMany({ where: { id, ...(read ? { readAt: null } : {}) }, data: { readAt: read ? new Date() : null } });
    const result = await prisma.contactMessage.findUnique({ where: { id } });
    if (!result) throw new NotFoundError('Message', id);
    res.setHeader('Cache-Control', 'no-store');
    sendSuccess(res, req, result);
  } catch (error) { next(error); }
});
export { router as adminContactRouter };
