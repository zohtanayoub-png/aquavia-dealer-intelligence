-- CreateEnum
CREATE TYPE "BusinessClassification" AS ENUM ('HOT_TUB_SPA_RETAILER', 'POOL_AND_SPA_COMPANY', 'POOL_COMPANY', 'WELLNESS_EQUIPMENT', 'SAUNA_HAMMAM_EQUIPMENT', 'OUTDOOR_LIVING', 'HOTEL_HOSPITALITY_SUPPLIER', 'CONSTRUCTION_LANDSCAPE_RELEVANT', 'MASSAGE_DAY_SPA', 'BEAUTY_AESTHETICS', 'HOTEL_SPA_ONLY', 'HAMMAM_SERVICE_ONLY', 'IRRELEVANT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CommercialRelevance" AS ENUM ('HIGHLY_RELEVANT', 'RELEVANT', 'POSSIBLE', 'LOW_RELEVANCE', 'IRRELEVANT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EvidenceKind" ADD VALUE 'PRODUCT_EVIDENCE';
ALTER TYPE "EvidenceKind" ADD VALUE 'DEALER_LOCATOR';
ALTER TYPE "EvidenceKind" ADD VALUE 'NEGATIVE_SIGNAL';
ALTER TYPE "EvidenceKind" ADD VALUE 'CLASSIFICATION';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "brandEvidence" JSONB,
ADD COLUMN     "classification" "BusinessClassification" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "classificationConfidence" "Confidence" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "classificationReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "classificationStage" INTEGER,
ADD COLUMN     "classifiedAt" TIMESTAMP(3),
ADD COLUMN     "commercialRelevance" "CommercialRelevance" NOT NULL DEFAULT 'POSSIBLE',
ADD COLUMN     "dealerFitBreakdown" JSONB,
ADD COLUMN     "dealerFitScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isDealerProspect" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "negativeSignals" JSONB,
ADD COLUMN     "notDealerProspectReason" TEXT,
ADD COLUMN     "positiveSignals" JSONB,
ADD COLUMN     "productEvidence" JSONB,
ADD COLUMN     "relevanceOverride" "CommercialRelevance",
ADD COLUMN     "relevanceOverrideAt" TIMESTAMP(3),
ADD COLUMN     "relevanceOverrideBy" TEXT,
ADD COLUMN     "relevanceOverrideNote" TEXT,
ADD COLUMN     "whyDealer" TEXT,
ADD COLUMN     "whyNotDealer" TEXT;

-- CreateIndex
CREATE INDEX "Company_commercialRelevance_dealerFitScore_idx" ON "Company"("commercialRelevance", "dealerFitScore");

-- CreateIndex
CREATE INDEX "Company_classification_idx" ON "Company"("classification");

-- CreateIndex
CREATE INDEX "Company_isDealerProspect_idx" ON "Company"("isDealerProspect");
