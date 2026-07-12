-- AlterTable
ALTER TABLE "DiaryProductLog" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "amOrder" INTEGER,
ADD COLUMN     "pmOrder" INTEGER;
