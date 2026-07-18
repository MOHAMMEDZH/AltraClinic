export interface InventoryListFilter {
  tenantId: string;
  branchId?: string | null;
  categoryId?: string | null;
  q?: string;
  status?: 'active' | 'archived' | 'all';
  stock?: 'all' | 'low' | 'out' | 'expiring' | 'expired';
  limit: number;
  offset: number;
}

export interface InventoryListResult {
  items: import('../entities/inventory-item.entity').InventoryItem[];
  total: number;
}

export interface ConsumptionLogRecord {
  id: string;
  inventoryItemId: string;
  sku: string;
  itemNameEn: string;
  quantityUsed: number;
  unit: string;
  unitPrice: number | null;
  consumedBy: string;
  notes: string | null;
  encounterId: string | null;
  patientId: string | null;
  procedureCode: string | null;
  invoiceId: string | null;
  invoiceLineItemId: string | null;
  consumedAt: Date;
}

export interface ConsumptionListFilter {
  tenantId: string;
  itemId?: string;
  encounterId?: string;
  patientId?: string;
  procedureCode?: string;
  invoiceId?: string;
  unbilled?: boolean;
  limit: number;
  offset: number;
}

export interface ConsumptionListResult {
  consumptions: ConsumptionLogRecord[];
  total: number;
}
