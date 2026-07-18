export const DEFAULT_INVENTORY_CATEGORIES = [
  { key: 'medications', nameEn: 'Medications', nameAr: 'أدوية', sortOrder: 1 },
  { key: 'medical_supplies', nameEn: 'Medical Supplies', nameAr: 'مستلزمات طبية', sortOrder: 2 },
  { key: 'dental_materials', nameEn: 'Dental Materials', nameAr: 'مواد أسنان', sortOrder: 3 },
  { key: 'beauty_products', nameEn: 'Beauty Products', nameAr: 'منتجات تجميل', sortOrder: 4 },
  { key: 'consumables', nameEn: 'Consumables', nameAr: 'مستهلكات', sortOrder: 5 },
  { key: 'equipment', nameEn: 'Equipment', nameAr: 'معدات', sortOrder: 6 },
  { key: 'laboratory_supplies', nameEn: 'Laboratory Supplies', nameAr: 'مستلزمات مختبر', sortOrder: 7 },
] as const;

export interface InventoryCategoryRecord {
  categoryId: string;
  tenantId: string;
  key: string;
  nameEn: string;
  nameAr: string | null;
  sortOrder: number;
  isSystem: boolean;
}
