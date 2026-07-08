-- AlterTable
ALTER TABLE "requests" ADD COLUMN     "budget_estimate_ron" INTEGER,
ADD COLUMN     "country" VARCHAR(2) NOT NULL DEFAULT 'RO';
