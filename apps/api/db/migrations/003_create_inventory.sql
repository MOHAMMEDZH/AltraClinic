-- Migration: create inventory_items table
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  branch_id UUID,
  sku TEXT NOT NULL,
  name JSONB NOT NULL,
  unit TEXT NOT NULL,
  quantity_on_hand NUMERIC NOT NULL DEFAULT 0,
  reorder_threshold NUMERIC NOT NULL DEFAULT 0,
  expiry_date TIMESTAMP WITH TIME ZONE NULL,
  supplier_id UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_tenant_sku ON inventory_items (tenant_id, sku);
CREATE INDEX IF NOT EXISTS idx_inventory_tenant_branch ON inventory_items (tenant_id, branch_id);
