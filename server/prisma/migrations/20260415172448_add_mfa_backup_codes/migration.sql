-- AlterTable
ALTER TABLE "mfa_setups" ADD COLUMN     "backup_codes" TEXT[] DEFAULT ARRAY[]::TEXT[];
