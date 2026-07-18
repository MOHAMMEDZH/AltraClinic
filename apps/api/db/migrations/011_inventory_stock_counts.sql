-- Migration: cycle count / physical stock count sessions

CREATE TABLE IF NOT EXISTS inventory_stock_counts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  count_number VARCHAR(30) NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES inventory_warehouses(id) ON DELETE RESTRICT,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  notes TEXT,
  requested_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, count_number)
);

CREATE INDEX IF NOT EXISTS idx_inv_stock_counts_tenant ON inventory_stock_counts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_stock_counts_tenant_status ON inventory_stock_counts (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_inv_stock_counts_warehouse ON inventory_stock_counts (warehouse_id);

CREATE TABLE IF NOT EXISTS inventory_stock_count_lines (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  stock_count_id UUID NOT NULL REFERENCES inventory_stock_counts(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  system_quantity NUMERIC(18, 4) NOT NULL,
  counted_quantity NUMERIC(18, 4),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_count_lines_count ON inventory_stock_count_lines (stock_count_id);
CREATE INDEX IF NOT EXISTS idx_inv_count_lines_item ON inventory_stock_count_lines (inventory_item_id);
