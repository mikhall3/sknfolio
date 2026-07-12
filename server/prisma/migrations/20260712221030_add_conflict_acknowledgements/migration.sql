-- CreateTable
CREATE TABLE "ConflictAcknowledgement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ingredientA" TEXT NOT NULL,
    "ingredientB" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConflictAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConflictAcknowledgement_userId_ingredientA_ingredientB_key" ON "ConflictAcknowledgement"("userId", "ingredientA", "ingredientB");

-- AddForeignKey
ALTER TABLE "ConflictAcknowledgement" ADD CONSTRAINT "ConflictAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
