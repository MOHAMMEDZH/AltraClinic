import type { StockCountListFilter, StockCountRecord, StockCountSummaryCounts } from './stock-count.types';

export interface StockCountRepository {
  create(input: {
    tenantId: string;
    warehouseId: string;
    notes?: string | null;
    requestedBy: string;
    itemIds?: string[];
  }): Promise<{ countId: string; countNumber: string }>;
  list(filter: StockCountListFilter): Promise<{ counts: StockCountRecord[]; total: number }>;
  findById(tenantId: string, countId: string): Promise<StockCountRecord | null>;
  start(tenantId: string, countId: string): Promise<void>;
  updateLine(tenantId: string, lineId: string, countedQuantity: number): Promise<void>;
  submit(tenantId: string, countId: string): Promise<void>;
  approve(tenantId: string, countId: string, approvedBy: string): Promise<void>;
  cancel(tenantId: string, countId: string): Promise<void>;
  getSummaryCounts(tenantId: string): Promise<StockCountSummaryCounts>;
  findCountIdByLineId(tenantId: string, lineId: string): Promise<string | null>;
}
