export interface InventoryCategoryRepository {
  ensureDefaults(tenantId: string): Promise<void>;
  list(tenantId: string): Promise<
    Array<{
      categoryId: string;
      key: string;
      nameEn: string;
      nameAr: string | null;
      sortOrder: number;
      isSystem: boolean;
    }>
  >;
  createCustom(input: {
    tenantId: string;
    key: string;
    nameEn: string;
    nameAr?: string | null;
  }): Promise<{ categoryId: string }>;
  findByKey(tenantId: string, key: string): Promise<{ categoryId: string } | null>;
}
