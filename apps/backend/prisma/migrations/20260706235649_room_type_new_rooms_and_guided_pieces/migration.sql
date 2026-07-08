-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "room_type" ADD VALUE 'HALLWAY';
ALTER TYPE "room_type" ADD VALUE 'PANTRY';
ALTER TYPE "room_type" ADD VALUE 'LAUNDRY';
ALTER TYPE "room_type" ADD VALUE 'BALCONY';
ALTER TYPE "room_type" ADD VALUE 'PIECE_WARDROBE';
ALTER TYPE "room_type" ADD VALUE 'PIECE_TV_UNIT';
ALTER TYPE "room_type" ADD VALUE 'PIECE_BOOKCASE';
ALTER TYPE "room_type" ADD VALUE 'PIECE_DESK';
ALTER TYPE "room_type" ADD VALUE 'PIECE_BED';
ALTER TYPE "room_type" ADD VALUE 'PIECE_DRESSER';
ALTER TYPE "room_type" ADD VALUE 'PIECE_TABLE';
ALTER TYPE "room_type" ADD VALUE 'PIECE_SHOE_CABINET';
ALTER TYPE "room_type" ADD VALUE 'PIECE_NIGHTSTAND';
ALTER TYPE "room_type" ADD VALUE 'PIECE_BENCH';
