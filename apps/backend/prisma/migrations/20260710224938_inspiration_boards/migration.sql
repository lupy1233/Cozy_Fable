-- CreateTable
CREATE TABLE "inspiration_boards" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "inspiration_boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspiration_board_items" (
    "board_id" TEXT NOT NULL,
    "photo_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspiration_board_items_pkey" PRIMARY KEY ("board_id","photo_id")
);

-- CreateIndex
CREATE INDEX "inspiration_boards_user_id_idx" ON "inspiration_boards"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "inspiration_boards_user_id_name_key" ON "inspiration_boards"("user_id", "name");

-- CreateIndex
CREATE INDEX "inspiration_board_items_photo_id_idx" ON "inspiration_board_items"("photo_id");

-- AddForeignKey
ALTER TABLE "inspiration_boards" ADD CONSTRAINT "inspiration_boards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspiration_board_items" ADD CONSTRAINT "inspiration_board_items_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "inspiration_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspiration_board_items" ADD CONSTRAINT "inspiration_board_items_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "inspiration_photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
