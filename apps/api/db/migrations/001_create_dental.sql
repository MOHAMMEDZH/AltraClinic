-- Migration: create dental charts table
-- Note: adapt to your migration tool (Prisma/TypeORM/etc.)
CREATE TABLE IF NOT EXISTS dental_charts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  teeth JSONB NOT NULL,
  procedures JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dental_charts_tenant_patient ON dental_charts(tenant_id, patient_id);
