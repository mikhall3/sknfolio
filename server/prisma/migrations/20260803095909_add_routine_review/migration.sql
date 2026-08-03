-- AlterTable
ALTER TABLE "DiaryEntry" ADD COLUMN     "routineReviewGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "routineReviewPairing" TEXT,
ADD COLUMN     "routineReviewSignature" TEXT,
ADD COLUMN     "routineReviewSummary" TEXT,
ADD COLUMN     "routineReviewTomorrow" TEXT;
