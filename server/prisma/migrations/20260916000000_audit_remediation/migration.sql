-- Preserve all cart quantities while merging NULL/empty duplicate variants.
CREATE TEMP TABLE audit_cart_merge AS
SELECT MIN(id) AS id, user_id, product_id, COALESCE(size, '') AS size,
       COALESCE(color, '') AS color, SUM(quantity)::INTEGER AS quantity
FROM cart_items GROUP BY user_id, product_id, COALESCE(size, ''), COALESCE(color, '');
DELETE FROM cart_items WHERE id NOT IN (SELECT id FROM audit_cart_merge);
UPDATE cart_items c SET size = m.size, color = m.color, quantity = m.quantity
FROM audit_cart_merge m WHERE c.id = m.id;
DROP TABLE audit_cart_merge;

-- Old JWTs lack audience/use/version claims. Require fresh authentication.
DELETE FROM refresh_tokens;
DELETE FROM password_reset_tokens;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verified_at" TIMESTAMP(3),
ADD COLUMN     "session_version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "checkout_key" TEXT,
ADD COLUMN     "coupon_reserved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "payment_status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "refunded_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "request_hash" TEXT,
ADD COLUMN     "stock_released_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "cart_items" ALTER COLUMN "size" SET NOT NULL,
ALTER COLUMN "size" SET DEFAULT '',
ALTER COLUMN "color" SET NOT NULL,
ALTER COLUMN "color" SET DEFAULT '';

-- AlterTable
ALTER TABLE "newsletter_subscriptions" ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "consent_at" TIMESTAMP(3),
ADD COLUMN     "consent_version" TEXT,
ADD COLUMN     "revoked_at" TIMESTAMP(3),
ADD COLUMN     "token_expires_at" TIMESTAMP(3),
ADD COLUMN     "token_hash" TEXT,
ADD COLUMN     "unsubscribe_hash" TEXT,
ALTER COLUMN "is_active" SET DEFAULT false;

-- AlterTable
ALTER TABLE "loyalty_transactions" ADD COLUMN     "coupon_code" TEXT,
ADD COLUMN     "dedup_key" TEXT;

-- AlterTable
ALTER TABLE "email_preferences" ALTER COLUMN "promotions" SET DEFAULT false,
ALTER COLUMN "newsletter" SET DEFAULT false;

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_outbox" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");

-- CreateIndex
CREATE INDEX "email_outbox_processed_at_available_at_idx" ON "email_outbox"("processed_at", "available_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_checkout_key_key" ON "orders"("checkout_key");

-- CreateIndex
CREATE INDEX "orders_status_expires_at_idx" ON "orders"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscriptions_token_hash_key" ON "newsletter_subscriptions"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscriptions_unsubscribe_hash_key" ON "newsletter_subscriptions"("unsubscribe_hash");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_transactions_dedup_key_key" ON "loyalty_transactions"("dedup_key");

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Preserve prior financial states. Legacy pending reservations require manual
-- reconciliation: the old implementation did not reliably decrement stock.
UPDATE orders SET payment_status = CASE WHEN status = 'refunded' THEN 'refunded' ELSE 'paid' END,
  refunded_cents = CASE WHEN status = 'refunded' THEN total_cents ELSE 0 END
WHERE status IN ('paid', 'confirmed', 'processing', 'shipped', 'delivered', 'refunded');
-- NOT VALID protects new writes while permitting operators to reconcile old bad rows.
ALTER TABLE product_variants ADD CONSTRAINT stock_nonnegative CHECK (stock >= 0) NOT VALID;
ALTER TABLE orders ADD CONSTRAINT refund_bounds CHECK (refunded_cents >= 0 AND refunded_cents <= total_cents) NOT VALID;
ALTER TABLE coupons ADD CONSTRAINT coupon_discount_bounds CHECK (discount_value > 0 AND (discount_type <> 'percentage' OR discount_value <= 100)) NOT VALID;
