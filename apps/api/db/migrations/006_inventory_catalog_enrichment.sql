-- Migration: inventory categories + catalog enrichment fields
CREATE TABLE IF NOT EXISTS inventory_categories (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  key VARCHAR(50) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  sort_order INT NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);

CREATE INDEX IF NOT EXISTS idx_inv_categories_tenant ON inventory_categories (tenant_id);

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES inventory_categories(id) ON DELETE SET NULL;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS brand VARCHAR(100);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS min_quantity NUMERIC(18, 4);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS max_quantity NUMERIC(18, 4);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS selling_price NUMERIC(18, 4);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS storage_location VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_inv_items_tenant_category ON inventory_items (tenant_id, category_id);
CREATE INDEX IF NOT EXISTS idx_inv_items_tenant_barcode ON inventory_items (tenant_id, barcode);
