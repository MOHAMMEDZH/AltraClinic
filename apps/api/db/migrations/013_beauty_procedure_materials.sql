-- Migration: beauty treatment type → inventory material mappings

CREATE TABLE IF NOT EXISTS beauty_procedure_materials (
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

CREATE INDEX IF NOT EXISTS idx_beauty_proc_materials_tenant ON beauty_procedure_materials (tenant_id);
CREATE INDEX IF NOT EXISTS idx_beauty_proc_materials_code ON beauty_procedure_materials (tenant_id, procedure_code);
