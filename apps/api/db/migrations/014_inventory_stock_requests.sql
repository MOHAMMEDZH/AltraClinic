-- Migration: internal stock requests (department / clinical)

CREATE TABLE IF NOT EXISTS inventory_stock_requests (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  request_number VARCHAR(30) NOT NULL,
  request_type VARCHAR(20) NOT NULL DEFAULT 'DEPARTMENT',
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  department_name VARCHAR(120),
  patient_id UUID,
  warehouse_id UUID REFERENCES inventory_warehouses(id) ON DELETE SET NULL,
  notes TEXT,
  requested_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejected_by UUID,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  fulfilled_by UUID,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, request_number)
);

CREATE INDEX IF NOT EXISTS idx_inv_stock_requests_tenant ON inventory_stock_requests (tenant_id);
CREATE INDEX IF NOT EXISTS idx_inv_stock_requests_tenant_status ON inventory_stock_requests (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_inv_stock_requests_requested_by ON inventory_stock_requests (tenant_id, requested_by);

CREATE TABLE IF NOT EXISTS inventory_stock_request_lines (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  stock_request_id UUID NOT NULL REFERENCES inventory_stock_requests(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity_requested NUMERIC(18, 4) NOT NULL,
  quantity_fulfilled NUMERIC(18, 4) NOT NULL DEFAULT 0,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_request_lines_request ON inventory_stock_request_lines (stock_request_id);
CREATE INDEX IF NOT EXISTS idx_inv_request_lines_item ON inventory_stock_request_lines (inventory_item_id);
