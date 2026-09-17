CREATE INDEX "contact_messages_read_at_created_at_id_idx" ON "contact_messages"("read_at", "created_at", "id");
CREATE INDEX "contact_messages_created_at_id_idx" ON "contact_messages"("created_at", "id");

ALTER TABLE "orders" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "orders" ADD CONSTRAINT "orders_locale_supported" CHECK ("locale" IN ('en', 'fr'));
