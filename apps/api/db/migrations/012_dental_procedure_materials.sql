-- Migration: dental procedure → inventory material mappings + clinical consumption context

CREATE TABLE IF NOT EXISTS dental_procedure_materials (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  procedure_code VARCHAR(30) NOT NULL,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  default_quantity NUMERIC(18, 4) NOT NULL DEFAULT 1,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, procedure_code, inventory_item_id)
);

CREATE INDEX IF NOT EXISTS idx_dental_proc_materials_tenant ON dental_procedure_materials (tenant_id);
CREATE INDEX IF NOT EXISTS idx_dental_proc_materials_code ON dental_procedure_materials (tenant_id, procedure_code);

ALTER TABLE inventory_consumption_logs
  ADD COLUMN IF NOT EXISTS patient_id UUID,
  ADD COLUMN IF NOT EXISTS procedure_code VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_inv_consumption_patient ON inventory_consumption_logs (tenant_id, patient_id);

ALTER TABLE inventory_stock_movements
  ADD COLUMN IF NOT EXISTS patient_id UUID,
  ADD COLUMN IF NOT EXISTS procedure_code VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_inv_movements_patient ON inventory_stock_movements (tenant_id, patient_id);
