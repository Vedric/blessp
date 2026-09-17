-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "billing_address" JSONB,
ADD COLUMN     "shipping_cents" INTEGER NOT NULL DEFAULT 0;
