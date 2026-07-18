export interface ListInventoryItemsQuery {
  branchId?: string | null;
  categoryId?: string | null;
  q?: string;
  status?: 'active' | 'archived' | 'all';
  stock?: 'all' | 'low' | 'out' | 'expiring' | 'expired';
  limit?: number;
  offset?: number;
}
