-- CreateTable
CREATE TABLE "chat_thread_reads" (
    "chat_thread_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "last_read_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "chat_thread_reads_pkey" PRIMARY KEY ("chat_thread_id","user_id")
);

-- CreateIndex
CREATE INDEX "chat_thread_reads_user_id_idx" ON "chat_thread_reads"("user_id");

-- AddForeignKey
ALTER TABLE "chat_thread_reads" ADD CONSTRAINT "chat_thread_reads_chat_thread_id_fkey" FOREIGN KEY ("chat_thread_id") REFERENCES "chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_thread_reads" ADD CONSTRAINT "chat_thread_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
