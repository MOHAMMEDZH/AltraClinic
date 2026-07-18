-- Migration: warehouses, location stock, and inter-location transfers

CREATE TABLE IF NOT EXISTS inventory_warehouses (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  branch_id UUID,
  code VARCHAR(50) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  address VARCHAR(500),
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_inv_warehouses_tenant ON inventory_warehouses (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_warehouses_tenant_default ON inventory_warehouses (tenant_id, is_default);

CREATE TABLE IF NOT EXISTS inventory_warehouse_stock (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  warehouse_id UUID NOT NULL REFERENCES inventory_warehouses(id) ON DELETE RESTRICT,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity_on_hand NUMERIC(18, 4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, warehouse_id, inventory_item_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_wh_stock_tenant ON inventory_warehouse_stock (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_wh_stock_warehouse ON inventory_warehouse_stock (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inv_wh_stock_item ON inventory_warehouse_stock (inventory_item_id);

CREATE TABLE IF NOT EXISTS inventory_stock_transfers (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  transfer_number VARCHAR(30) NOT NULL,
  from_warehouse_id UUID NOT NULL REFERENCES inventory_warehouses(id) ON DELETE RESTRICT,
  to_warehouse_id UUID NOT NULL REFERENCES inventory_warehouses(id) ON DELETE RESTRICT,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  notes TEXT,
  requested_by UUID NOT NULL,
  shipped_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, transfer_number)
);

CREATE INDEX IF NOT EXISTS idx_inv_transfers_tenant ON inventory_stock_transfers (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_transfers_tenant_status ON inventory_stock_transfers (tenant_id, status);

CREATE TABLE IF NOT EXISTS inventory_stock_transfer_lines (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  stock_transfer_id UUID NOT NULL REFERENCES inventory_stock_transfers(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity NUMERIC(18, 4) NOT NULL,
  quantity_received NUMERIC(18, 4) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_transfer_lines_transfer ON inventory_stock_transfer_lines (stock_transfer_id);
CREATE INDEX IF NOT EXISTS idx_inv_transfer_lines_item ON inventory_stock_transfer_lines (inventory_item_id);

ALTER TABLE inventory_stock_movements ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES inventory_warehouses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_inv_movements_warehouse ON inventory_stock_movements (tenant_id, warehouse_id);

-- Backfill: one default warehouse per tenant with existing inventory items
INSERT INTO inventory_warehouses (id, tenant_id, code, name_en, is_default, is_active)
SELECT gen_random_uuid(), t.tenant_id, 'MAIN', 'Main Store', true, true
FROM (SELECT DISTINCT tenant_id FROM inventory_items WHERE deleted_at IS NULL) t
WHERE NOT EXISTS (
  SELECT 1 FROM inventory_warehouses w WHERE w.tenant_id = t.tenant_id AND w.deleted_at IS NULL
);

INSERT INTO inventory_warehouse_stock (id, tenant_id, warehouse_id, inventory_item_id, quantity_on_hand)
SELECT gen_random_uuid(), i.tenant_id, w.id, i.id, i.quantity_on_hand
FROM inventory_items i
JOIN inventory_warehouses w ON w.tenant_id = i.tenant_id AND w.is_default = true AND w.deleted_at IS NULL
WHERE i.deleted_at IS NULL
  AND i.quantity_on_hand <> 0
ON CONFLICT (tenant_id, warehouse_id, inventory_item_id) DO NOTHING;
