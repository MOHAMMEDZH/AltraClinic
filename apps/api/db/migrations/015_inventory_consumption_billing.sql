-- Migration: link inventory consumption logs to billing invoices

ALTER TABLE inventory_consumption_logs
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_line_item_id UUID REFERENCES invoice_line_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inv_consumption_invoice
  ON inventory_consumption_logs (tenant_id, invoice_id);

CREATE INDEX IF NOT EXISTS idx_inv_consumption_unbilled_patient
  ON inventory_consumption_logs (tenant_id, patient_id)
  WHERE invoice_id IS NULL AND patient_id IS NOT NULL;
