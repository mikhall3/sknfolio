-- CreateEnum
CREATE TYPE "SizeType" AS ENUM ('SAMPLE', 'ONE_TIME_USE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Category" ADD VALUE 'MICELLAR_WATER';
ALTER TYPE "Category" ADD VALUE 'MAKEUP_WIPE';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "sizeType" "SizeType";
