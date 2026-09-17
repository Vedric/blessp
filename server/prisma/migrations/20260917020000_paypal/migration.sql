ALTER TABLE "orders"
ADD COLUMN "payment_provider" TEXT NOT NULL DEFAULT 'stripe',
ADD COLUMN "paypal_capture_id" TEXT,
ADD COLUMN "paypal_capture_requested_at" TIMESTAMP(3),
ADD CONSTRAINT "orders_payment_provider_check" CHECK ("payment_provider" IN ('stripe', 'paypal'));
CREATE UNIQUE INDEX "orders_paypal_capture_id_key" ON "orders"("paypal_capture_id");
CREATE TABLE "paypal_refunds" (
  "id" TEXT PRIMARY KEY,
  "order_id" TEXT NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "amount_cents" INTEGER NOT NULL CHECK ("amount_cents" > 0),
  "status" TEXT NOT NULL CHECK ("status" IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'))
);
CREATE INDEX "paypal_refunds_order_id_idx" ON "paypal_refunds"("order_id");
