-- CreateEnum
CREATE TYPE "Tristate" AS ENUM ('YES', 'NO', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('A', 'B', 'C', 'D');

-- CreateEnum
CREATE TYPE "CrmStatus" AS ENUM ('NEW', 'TO_CONTACT', 'CONTACTED', 'REPLIED', 'MEETING', 'QUALIFIED', 'NEGOTIATING', 'DEALER', 'NOT_INTERESTED', 'DO_NOT_CONTACT');

-- CreateEnum
CREATE TYPE "NextAction" AS ENUM ('VISIT', 'CALL', 'EMAIL', 'LINKEDIN', 'QUALIFY_FIRST', 'LOW_PRIORITY');

-- CreateEnum
CREATE TYPE "SearchDepth" AS ENUM ('QUICK', 'DEEP');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PENDING', 'DISCOVERING', 'ENRICHING', 'SCORING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExclusionKind" AS ENUM ('EXISTING_DEALER', 'ACTIVE_NEGOTIATION', 'DO_NOT_CONTACT', 'KNOWN_COMPETITOR');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('DISCOVERY', 'IDENTITY', 'CONTACT', 'SPA_ACTIVITY', 'POOL_ACTIVITY', 'SAUNA_ACTIVITY', 'WELLNESS_ACTIVITY', 'SHOWROOM', 'BRAND', 'COMPETITOR_BRAND', 'YEAR_FOUNDED', 'SPA_SINCE', 'DECISION_MAKER', 'SOCIAL', 'LOCATIONS', 'HOSPITALITY', 'OTHER');

-- CreateEnum
CREATE TYPE "ProviderName" AS ENUM ('GOOGLE_PLACES', 'TAVILY', 'ANTHROPIC', 'MANUAL');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "region" TEXT,
    "city" TEXT,
    "fullAddress" TEXT,
    "postalCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "googlePlaceId" TEXT,
    "googleRating" DOUBLE PRECISION,
    "googleReviewCount" INTEGER,
    "googleTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "googleMapsUri" TEXT,
    "googleBusinessStatus" TEXT,
    "website" TEXT,
    "websiteDomain" TEXT,
    "phone" TEXT,
    "publicEmail" TEXT,
    "whatsapp" TEXT,
    "linkedinUrl" TEXT,
    "instagramUrl" TEXT,
    "facebookUrl" TEXT,
    "youtubeUrl" TEXT,
    "spaActivity" "Tristate" NOT NULL DEFAULT 'UNKNOWN',
    "poolActivity" "Tristate" NOT NULL DEFAULT 'UNKNOWN',
    "saunaActivity" "Tristate" NOT NULL DEFAULT 'UNKNOWN',
    "wellnessActivity" "Tristate" NOT NULL DEFAULT 'UNKNOWN',
    "hammamActivity" "Tristate" NOT NULL DEFAULT 'UNKNOWN',
    "outdoorLiving" "Tristate" NOT NULL DEFAULT 'UNKNOWN',
    "hospitalityActivity" "Tristate" NOT NULL DEFAULT 'UNKNOWN',
    "showroom" "Tristate" NOT NULL DEFAULT 'UNKNOWN',
    "yearFounded" INTEGER,
    "yearFoundedConfidence" "Confidence" NOT NULL DEFAULT 'UNKNOWN',
    "spaSinceYear" INTEGER,
    "spaSinceConfidence" "Confidence" NOT NULL DEFAULT 'UNKNOWN',
    "yearsInSpaIndustry" INTEGER,
    "locationCount" INTEGER,
    "brands" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "competitorBrands" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "representsAquavia" "Tristate" NOT NULL DEFAULT 'UNKNOWN',
    "score" INTEGER NOT NULL DEFAULT 0,
    "priority" "Priority" NOT NULL DEFAULT 'D',
    "scoreBreakdown" JSONB,
    "whyThisCompany" TEXT,
    "recommendedAction" "NextAction" NOT NULL DEFAULT 'QUALIFY_FIRST',
    "confidence" "Confidence" NOT NULL DEFAULT 'UNKNOWN',
    "dataCompleteness" INTEGER NOT NULL DEFAULT 0,
    "crmStatus" "CrmStatus" NOT NULL DEFAULT 'NEW',
    "salesNotes" TEXT,
    "lastContactAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "ownerName" TEXT,
    "isExcluded" BOOLEAN NOT NULL DEFAULT false,
    "exclusionKind" "ExclusionKind",
    "exclusionNote" TEXT,
    "researchNotes" TEXT,
    "enrichmentStatus" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionMaker" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "position" TEXT,
    "roleBucket" TEXT,
    "linkedinUrl" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "sourceUrl" TEXT,
    "sourceNote" TEXT,
    "confidence" "Confidence" NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisionMaker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceRef" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "snippet" TEXT,
    "kind" "EvidenceKind" NOT NULL DEFAULT 'OTHER',
    "provider" "ProviderName" NOT NULL DEFAULT 'TAVILY',
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchRun" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "city" TEXT,
    "depth" "SearchDepth" NOT NULL DEFAULT 'QUICK',
    "status" "RunStatus" NOT NULL DEFAULT 'PENDING',
    "queryPlan" JSONB,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL DEFAULT 0,
    "discoveredCount" INTEGER NOT NULL DEFAULT 0,
    "newCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "enrichedCount" INTEGER NOT NULL DEFAULT 0,
    "excludedCount" INTEGER NOT NULL DEFAULT 0,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchRunLog" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchRunLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchRunCompany" (
    "runId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "isNew" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchRunCompany_pkey" PRIMARY KEY ("runId","companyId")
);

-- CreateTable
CREATE TABLE "ExclusionEntry" (
    "id" TEXT NOT NULL,
    "kind" "ExclusionKind" NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "countryCode" TEXT,
    "city" TEXT,
    "domain" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExclusionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "notes" TEXT,
    "targetCount" INTEGER,
    "isPriority" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_dedupeKey_key" ON "Company"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Company_googlePlaceId_key" ON "Company"("googlePlaceId");

-- CreateIndex
CREATE INDEX "Company_countryCode_city_idx" ON "Company"("countryCode", "city");

-- CreateIndex
CREATE INDEX "Company_priority_score_idx" ON "Company"("priority", "score");

-- CreateIndex
CREATE INDEX "Company_crmStatus_idx" ON "Company"("crmStatus");

-- CreateIndex
CREATE INDEX "Company_isExcluded_idx" ON "Company"("isExcluded");

-- CreateIndex
CREATE INDEX "Company_websiteDomain_idx" ON "Company"("websiteDomain");

-- CreateIndex
CREATE INDEX "DecisionMaker_companyId_idx" ON "DecisionMaker"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionMaker_companyId_fullName_key" ON "DecisionMaker"("companyId", "fullName");

-- CreateIndex
CREATE INDEX "SourceRef_companyId_idx" ON "SourceRef"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceRef_companyId_url_kind_key" ON "SourceRef"("companyId", "url", "kind");

-- CreateIndex
CREATE INDEX "SearchRun_countryCode_idx" ON "SearchRun"("countryCode");

-- CreateIndex
CREATE INDEX "SearchRun_status_idx" ON "SearchRun"("status");

-- CreateIndex
CREATE INDEX "SearchRunLog_runId_at_idx" ON "SearchRunLog"("runId", "at");

-- CreateIndex
CREATE INDEX "SearchRunCompany_companyId_idx" ON "SearchRunCompany"("companyId");

-- CreateIndex
CREATE INDEX "ExclusionEntry_kind_idx" ON "ExclusionEntry"("kind");

-- CreateIndex
CREATE INDEX "ExclusionEntry_nameKey_idx" ON "ExclusionEntry"("nameKey");

-- CreateIndex
CREATE INDEX "ExclusionEntry_domain_idx" ON "ExclusionEntry"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "Market_countryCode_key" ON "Market"("countryCode");

-- AddForeignKey
ALTER TABLE "DecisionMaker" ADD CONSTRAINT "DecisionMaker_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRef" ADD CONSTRAINT "SourceRef_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchRunLog" ADD CONSTRAINT "SearchRunLog_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SearchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchRunCompany" ADD CONSTRAINT "SearchRunCompany_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SearchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchRunCompany" ADD CONSTRAINT "SearchRunCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
