-- Migration: purchase orders and lines
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  po_number VARCHAR(30) NOT NULL,
  supplier_id UUID REFERENCES inventory_suppliers(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  notes TEXT,
  requested_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, po_number)
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON purchase_orders (tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_status ON purchase_orders (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders (tenant_id, supplier_id);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity_ordered NUMERIC(18, 4) NOT NULL,
  quantity_received NUMERIC(18, 4) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(18, 4),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_lines_order ON purchase_order_lines (purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_lines_tenant ON purchase_order_lines (tenant_id);
CREATE INDEX IF NOT EXISTS idx_po_lines_item ON purchase_order_lines (inventory_item_id);
