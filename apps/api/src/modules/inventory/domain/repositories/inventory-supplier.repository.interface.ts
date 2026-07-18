export interface InventorySupplierRecord {
  supplierId: string;
  code: string;
  nameEn: string;
  nameAr: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  leadTimeDays: number | null;
  notes: string | null;
  isActive: boolean;
  linkedItemCount: number;
  orderCount: number;
  lastOrderDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventorySupplierListFilter {
  tenantId: string;
  q?: string;
  status?: 'active' | 'all';
  limit: number;
  offset: number;
}

export interface InventorySupplierRepository {
  list(filter: InventorySupplierListFilter): Promise<{ suppliers: InventorySupplierRecord[]; total: number }>;
  findById(tenantId: string, supplierId: string): Promise<InventorySupplierRecord | null>;
  findByCode(tenantId: string, code: string): Promise<{ supplierId: string } | null>;
  create(input: {
    tenantId: string;
    code: string;
    nameEn: string;
    nameAr?: string | null;
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    leadTimeDays?: number | null;
    notes?: string | null;
  }): Promise<{ supplierId: string }>;
  update(input: {
    tenantId: string;
    supplierId: string;
    code?: string;
    nameEn?: string;
    nameAr?: string | null;
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    leadTimeDays?: number | null;
    notes?: string | null;
  }): Promise<void>;
  deactivate(tenantId: string, supplierId: string): Promise<void>;
  reactivate(tenantId: string, supplierId: string): Promise<void>;
  countActive(tenantId: string): Promise<number>;
  existsActive(tenantId: string, supplierId: string): Promise<boolean>;
}
