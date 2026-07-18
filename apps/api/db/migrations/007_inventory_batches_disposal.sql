-- Migration: inventory batches and disposal logs
CREATE TABLE IF NOT EXISTS inventory_batches (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  lot_number VARCHAR(100),
  manufactured_date DATE,
  expiry_date DATE,
  quantity_on_hand NUMERIC(18, 4) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_batches_tenant ON inventory_batches (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_batches_item ON inventory_batches (inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inv_batches_tenant_expiry ON inventory_batches (tenant_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_inv_batches_tenant_status ON inventory_batches (tenant_id, status);

CREATE TABLE IF NOT EXISTS inventory_disposal_logs (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
  quantity NUMERIC(18, 4) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  notes TEXT,
  disposed_by UUID NOT NULL,
  disposed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_disposal_tenant ON inventory_disposal_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_disposal_item ON inventory_disposal_logs (inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inv_disposal_batch ON inventory_disposal_logs (batch_id);
CREATE INDEX IF NOT EXISTS idx_inv_disposal_tenant_at ON inventory_disposal_logs (tenant_id, disposed_at DESC);
