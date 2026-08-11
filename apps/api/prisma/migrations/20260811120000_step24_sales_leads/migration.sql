-- Flexible Step 24 — Leads and Sales Pipeline (commercial CRM aggregate only).
-- Contract: docs/LEADS_AND_SALES_PIPELINE.md
-- Additive only. No opportunities table, no pipeline_stages table, no trials.

CREATE TYPE "platform_sales_lead_stage" AS ENUM (
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'DEMO_SCHEDULED',
  'PROPOSAL',
  'WON',
  'LOST'
);

CREATE TYPE "platform_sales_lead_source" AS ENUM (
  'INBOUND',
  'OUTBOUND',
  'REFERRAL',
  'PARTNER',
  'EVENT',
  'OTHER'
);

CREATE TYPE "platform_sales_demo_status" AS ENUM (
  'NONE',
  'SCHEDULED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TABLE IF NOT EXISTS "platform_sales_leads" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "stage" "platform_sales_lead_stage" NOT NULL DEFAULT 'NEW',
  "source" "platform_sales_lead_source" NOT NULL DEFAULT 'OTHER',
  "ownerRepresentativeId" UUID,
  "organizationName" VARCHAR(255) NOT NULL,
  "contactName" VARCHAR(255) NOT NULL,
  "contactEmail" VARCHAR(320),
  "contactPhone" VARCHAR(64),
  "contactJobTitle" VARCHAR(160),
  "facilityTypeKey" VARCHAR(128),
  "specialtyKeys" JSONB NOT NULL DEFAULT '[]',
  "desiredModuleKeys" JSONB NOT NULL DEFAULT '[]',
  "estimatedUsers" INTEGER,
  "estimatedProviders" INTEGER,
  "estimatedLocations" INTEGER,
  "nextActionType" VARCHAR(64),
  "nextActionDueAt" TIMESTAMPTZ,
  "nextActionNote" VARCHAR(500),
  "demoScheduledAt" TIMESTAMPTZ,
  "demoTimezone" VARCHAR(64),
  "demoStatus" "platform_sales_demo_status" NOT NULL DEFAULT 'NONE',
  "demoNote" VARCHAR(500),
  "wonLostReason" VARCHAR(1000),
  "linkedPlatformTenantId" UUID,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "platform_sales_leads_ownerRepresentativeId_fkey"
    FOREIGN KEY ("ownerRepresentativeId") REFERENCES "platform_sales_representatives"("id") ON DELETE RESTRICT,
  CONSTRAINT "platform_sales_leads_linkedPlatformTenantId_fkey"
    FOREIGN KEY ("linkedPlatformTenantId") REFERENCES "platform_tenants"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "platform_sales_leads_ownerRepresentativeId_idx"
  ON "platform_sales_leads" ("ownerRepresentativeId");
CREATE INDEX IF NOT EXISTS "platform_sales_leads_stage_idx"
  ON "platform_sales_leads" ("stage");
CREATE INDEX IF NOT EXISTS "platform_sales_leads_createdAt_idx"
  ON "platform_sales_leads" ("createdAt");
CREATE INDEX IF NOT EXISTS "platform_sales_leads_createdAt_id_idx"
  ON "platform_sales_leads" ("createdAt", "id");
CREATE INDEX IF NOT EXISTS "platform_sales_leads_source_idx"
  ON "platform_sales_leads" ("source");
CREATE INDEX IF NOT EXISTS "platform_sales_leads_linkedPlatformTenantId_idx"
  ON "platform_sales_leads" ("linkedPlatformTenantId");

CREATE TABLE IF NOT EXISTS "platform_sales_lead_stage_history" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "leadId" UUID NOT NULL,
  "fromStage" "platform_sales_lead_stage",
  "toStage" "platform_sales_lead_stage" NOT NULL,
  "actorPlatformUserId" UUID NOT NULL,
  "reason" VARCHAR(1000),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "platform_sales_lead_stage_history_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "platform_sales_leads"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "platform_sales_lead_stage_history_lead_created_idx"
  ON "platform_sales_lead_stage_history" ("leadId", "createdAt");

CREATE TABLE IF NOT EXISTS "platform_sales_lead_ownership_history" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "leadId" UUID NOT NULL,
  "fromOwnerRepresentativeId" UUID,
  "toOwnerRepresentativeId" UUID,
  "actorPlatformUserId" UUID NOT NULL,
  "reason" VARCHAR(1000),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "platform_sales_lead_ownership_history_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "platform_sales_leads"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "platform_sales_lead_ownership_history_lead_created_idx"
  ON "platform_sales_lead_ownership_history" ("leadId", "createdAt");

CREATE TABLE IF NOT EXISTS "platform_sales_lead_notes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "leadId" UUID NOT NULL,
  "body" VARCHAR(2000) NOT NULL,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "platform_sales_lead_notes_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "platform_sales_leads"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "platform_sales_lead_notes_lead_created_idx"
  ON "platform_sales_lead_notes" ("leadId", "createdAt");
