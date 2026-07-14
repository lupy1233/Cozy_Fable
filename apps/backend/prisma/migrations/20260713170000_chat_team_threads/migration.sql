-- PO r6: chat_threads devine generic — CLAIM (client-firma, legat de claim_slot)
-- sau TEAM (chatul intern al firmei: un thread per firma, toti membrii).
-- Rollback: DROP CONSTRAINT chat_threads_company_id_fkey; DROP INDEX chat_threads_company_id_key;
--           ALTER TABLE chat_threads DROP COLUMN company_id, DROP COLUMN thread_type,
--           ALTER COLUMN claim_slot_id SET NOT NULL; DROP TYPE chat_thread_type;

-- CreateEnum
CREATE TYPE "chat_thread_type" AS ENUM ('CLAIM', 'TEAM');

-- AlterTable
ALTER TABLE "chat_threads" ADD COLUMN     "company_id" TEXT,
ADD COLUMN     "thread_type" "chat_thread_type" NOT NULL DEFAULT 'CLAIM',
ALTER COLUMN "claim_slot_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "chat_threads_company_id_key" ON "chat_threads"("company_id");

-- AddForeignKey
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
