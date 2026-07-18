import type { StockTransferListFilter, StockTransferRecord } from './stock-transfer.types';

export interface StockTransferRepository {
  create(input: {
    tenantId: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    notes?: string | null;
    requestedBy: string;
    lines: Array<{ itemId: string; quantity: number }>;
  }): Promise<{ transferId: string; transferNumber: string }>;
  list(filter: StockTransferListFilter): Promise<{ transfers: StockTransferRecord[]; total: number }>;
  findById(tenantId: string, transferId: string): Promise<StockTransferRecord | null>;
  ship(tenantId: string, transferId: string): Promise<void>;
  receiveLine(tenantId: string, lineId: string, quantity: number): Promise<void>;
  refreshStatus(tenantId: string, transferId: string): Promise<void>;
  cancel(tenantId: string, transferId: string): Promise<void>;
  getOpenCount(tenantId: string): Promise<number>;
}
