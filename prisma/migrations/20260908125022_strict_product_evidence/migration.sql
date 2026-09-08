-- CreateEnum
CREATE TYPE "ProductEvidenceLevel" AS ENUM ('VERIFIED_PRODUCT', 'STRONG_PRODUCT', 'WEAK_AMBIGUOUS', 'SERVICE_ONLY', 'NO_EVIDENCE');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "competitorEvidenceVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "physicalProductEvidence" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "productEvidenceLevel" "ProductEvidenceLevel" NOT NULL DEFAULT 'NO_EVIDENCE',
ADD COLUMN     "productEvidenceQuote" TEXT,
ADD COLUMN     "productEvidenceSource" TEXT,
ADD COLUMN     "relevanceConfidence" "Confidence" NOT NULL DEFAULT 'UNKNOWN';

-- CreateIndex
CREATE INDEX "Company_productEvidenceLevel_idx" ON "Company"("productEvidenceLevel");
