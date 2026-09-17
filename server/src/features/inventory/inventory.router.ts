import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../core/middleware/authenticate';
import { authorizeAdmin } from '../../core/middleware/authorize';
import { sendSuccess } from '../../core/types/response';
import type { AuthenticatedRequest } from '../../core/types/request.context';
import { CacheService } from '../../core/cache/cache.service';
import { getRedisClient } from '../../core/cache/redis.client';
import { InventoryService } from './inventory.service';
import { InventoryAdjustmentSchema, InventoryHistoryQuerySchema, InventoryQuerySchema } from './inventory.schema';

const router = Router();
const service = new InventoryService();
const cache = new CacheService(getRedisClient());
router.use(authenticate, authorizeAdmin);
router.get('/', async (req, res, next) => {
  try { sendSuccess(res, req, await service.list(InventoryQuerySchema.parse(req.query))); } catch (error) { next(error); }
});
router.get('/:id/history', async (req, res, next) => {
  try {
    const query = InventoryHistoryQuerySchema.parse(req.query);
    sendSuccess(res, req, await service.history(z.string().uuid().parse(req.params.id), query.page, query.perPage));
  } catch (error) { next(error); }
});
router.post('/:id/adjustments', async (req, res, next) => {
  try {
    const result = await service.adjust(z.string().uuid().parse(req.params.id), (req as unknown as AuthenticatedRequest).user.userId, InventoryAdjustmentSchema.parse(req.body));
    await cache.deleteByPattern('products:*');
    sendSuccess(res, req, result);
  } catch (error) { next(error); }
});
export { router as inventoryRouter };
