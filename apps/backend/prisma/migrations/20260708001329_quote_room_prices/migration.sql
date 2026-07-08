-- CreateTable
CREATE TABLE "quote_version_room_prices" (
    "id" TEXT NOT NULL,
    "quote_version_id" TEXT NOT NULL,
    "request_room_id" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "quote_version_room_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quote_version_room_prices_request_room_id_idx" ON "quote_version_room_prices"("request_room_id");

-- CreateIndex
CREATE UNIQUE INDEX "quote_version_room_prices_quote_version_id_request_room_id_key" ON "quote_version_room_prices"("quote_version_id", "request_room_id");

-- AddForeignKey
ALTER TABLE "quote_version_room_prices" ADD CONSTRAINT "quote_version_room_prices_quote_version_id_fkey" FOREIGN KEY ("quote_version_id") REFERENCES "quote_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_version_room_prices" ADD CONSTRAINT "quote_version_room_prices_request_room_id_fkey" FOREIGN KEY ("request_room_id") REFERENCES "request_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
