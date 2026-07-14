-- CreateEnum
CREATE TYPE "IngredientLookupStatus" AS ENUM ('NONE', 'PENDING', 'DONE', 'ERROR');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "ingredientLookupError" TEXT,
ADD COLUMN     "ingredientLookupStartedAt" TIMESTAMP(3),
ADD COLUMN     "ingredientLookupStatus" "IngredientLookupStatus" NOT NULL DEFAULT 'NONE';
