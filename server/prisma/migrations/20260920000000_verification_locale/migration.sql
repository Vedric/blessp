ALTER TABLE "email_verification_tokens" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_locale_check" CHECK ("locale" IN ('en', 'fr'));
