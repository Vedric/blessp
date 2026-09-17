import { z } from 'zod';

export const InventoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(100).default(''),
  status: z.enum(['all', 'low', 'out', 'available']).default('all'),
});
export const InventoryHistoryQuerySchema = InventoryQuerySchema.pick({ page: true, perPage: true });
export const InventoryAdjustmentSchema = z.object({
  expectedStock: z.number().int().min(0).max(2147483647),
  stock: z.number().int().min(0).max(1000000),
  reason: z.enum(['restock', 'count', 'damage', 'return', 'correction']),
  note: z.string().trim().max(500).default(''),
  requestId: z.string().uuid(),
}).strict();
export type InventoryQuery = z.infer<typeof InventoryQuerySchema>;
export type InventoryAdjustment = z.infer<typeof InventoryAdjustmentSchema>;
