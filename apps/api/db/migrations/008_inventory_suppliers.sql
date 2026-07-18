-- Migration: inventory suppliers + FK on items
CREATE TABLE IF NOT EXISTS inventory_suppliers (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address VARCHAR(500),
  lead_time_days INT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_inv_suppliers_tenant ON inventory_suppliers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_suppliers_tenant_active ON inventory_suppliers (tenant_id, deleted_at);

ALTER TABLE inventory_items DROP COLUMN IF EXISTS supplier_id;
ALTER TABLE inventory_items ADD COLUMN supplier_id UUID REFERENCES inventory_suppliers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_inv_items_supplier ON inventory_items (tenant_id, supplier_id);
