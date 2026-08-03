-- AlterTable
ALTER TABLE "Product" DROP COLUMN "fillLevel",
DROP COLUMN "sizeType";

-- DropEnum
DROP TYPE "SizeType";
