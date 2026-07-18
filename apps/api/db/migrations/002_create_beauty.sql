-- Migration: create beauty_services table
CREATE TABLE IF NOT EXISTS beauty_services (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  clinician_id UUID NOT NULL,
  service_type TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  notes JSONB NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beauty_tenant_patient ON beauty_services (tenant_id, patient_id);
