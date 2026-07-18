-- Phase 28 licensing completion: immutable license audit + communication dispatch ledger

CREATE TABLE "license_audit_events" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "actorId" UUID,
    "eventType" VARCHAR(100) NOT NULL,
    "previousPlan" VARCHAR(50),
    "newPlan" VARCHAR(50),
    "previousStatus" VARCHAR(50),
    "newStatus" VARCHAR(50),
    "moduleId" VARCHAR(50),
    "featureId" VARCHAR(50),
    "usageLimit" VARCHAR(50),
    "decision" VARCHAR(20) NOT NULL,
    "reason" TEXT NOT NULL,
    "correlationId" UUID,
    "requestId" VARCHAR(100),
    "source" VARCHAR(50) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "license_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "communication_dispatch_ledger" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "notificationId" UUID NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "usageMonth" VARCHAR(7) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "communication_dispatch_ledger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "communication_dispatch_ledger_notificationId_key" ON "communication_dispatch_ledger"("notificationId");
CREATE INDEX "communication_dispatch_ledger_tenantId_usageMonth_channel_idx" ON "communication_dispatch_ledger"("tenantId", "usageMonth", "channel");
CREATE INDEX "license_audit_events_tenantId_idx" ON "license_audit_events"("tenantId");
CREATE INDEX "license_audit_events_tenantId_eventType_idx" ON "license_audit_events"("tenantId", "eventType");
CREATE INDEX "license_audit_events_tenantId_createdAt_idx" ON "license_audit_events"("tenantId", "createdAt");

ALTER TABLE "license_audit_events" ADD CONSTRAINT "license_audit_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "communication_dispatch_ledger" ADD CONSTRAINT "communication_dispatch_ledger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Append-only enforcement for license audit events
CREATE OR REPLACE FUNCTION prevent_license_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'license_audit_events is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER license_audit_events_no_update
  BEFORE UPDATE ON "license_audit_events"
  FOR EACH ROW EXECUTE FUNCTION prevent_license_audit_mutation();

CREATE TRIGGER license_audit_events_no_delete
  BEFORE DELETE ON "license_audit_events"
  FOR EACH ROW EXECUTE FUNCTION prevent_license_audit_mutation();

-- RLS policies (tenant isolation)
ALTER TABLE "license_audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "communication_dispatch_ledger" ENABLE ROW LEVEL SECURITY;

CREATE POLICY license_audit_events_tenant_isolation ON "license_audit_events"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY communication_dispatch_ledger_tenant_isolation ON "communication_dispatch_ledger"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
