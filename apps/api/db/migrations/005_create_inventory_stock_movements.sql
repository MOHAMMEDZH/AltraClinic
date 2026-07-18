-- Migration: inventory stock movement ledger
CREATE TABLE IF NOT EXISTS inventory_stock_movements (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  movement_type VARCHAR(30) NOT NULL,
  quantity NUMERIC(18, 4) NOT NULL,
  quantity_before NUMERIC(18, 4) NOT NULL,
  quantity_after NUMERIC(18, 4) NOT NULL,
  reason VARCHAR(255),
  notes TEXT,
  encounter_id UUID,
  performed_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_movements_tenant ON inventory_stock_movements (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_item ON inventory_stock_movements (inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_tenant_created ON inventory_stock_movements (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_movements_tenant_type ON inventory_stock_movements (tenant_id, movement_type);
