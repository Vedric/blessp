CREATE TABLE "stock_adjustments" (
  "id" TEXT NOT NULL,
  "variant_id" TEXT,
  "actor_id" TEXT,
  "product_name" TEXT NOT NULL,
  "size" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "before" INTEGER NOT NULL,
  "after" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "note" TEXT,
  "request_id" TEXT,
  "request_hash" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_adjustments_nonnegative" CHECK ("before" >= 0 AND "after" >= 0),
  CONSTRAINT "stock_adjustments_reason" CHECK ("reason" IN ('initial', 'editor', 'restock', 'count', 'damage', 'return', 'correction'))
);
CREATE UNIQUE INDEX "stock_adjustments_request_id_key" ON "stock_adjustments"("request_id");
CREATE INDEX "stock_adjustments_variant_id_created_at_id_idx" ON "stock_adjustments"("variant_id", "created_at", "id");
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
