-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "ingredientLookupSummary" TEXT;

-- AlterTable
ALTER TABLE "ProductIngredient" ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT true;
