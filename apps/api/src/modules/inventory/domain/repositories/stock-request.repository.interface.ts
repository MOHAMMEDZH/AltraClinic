import type { Prisma } from '@prisma/client';
import type {
  StockRequestListFilter,
  StockRequestRecord,
  StockRequestSummaryCounts,
} from './stock-request.types';

export type StockRequestTx = Prisma.TransactionClient;

export interface StockRequestRepository {
  create(input: {
    tenantId: string;
    requestType: string;
    departmentName?: string | null;
    patientId?: string | null;
    warehouseId?: string | null;
    notes?: string | null;
    requestedBy: string;
    lines: Array<{ itemId: string; quantity: number; notes?: string | null }>;
  }): Promise<{ requestId: string; requestNumber: string }>;
  list(filter: StockRequestListFilter): Promise<{ requests: StockRequestRecord[]; total: number }>;
  findById(tenantId: string, requestId: string, tx?: StockRequestTx): Promise<StockRequestRecord | null>;
  submit(tenantId: string, requestId: string): Promise<void>;
  approve(tenantId: string, requestId: string, approvedBy: string): Promise<void>;
  reject(tenantId: string, requestId: string, rejectedBy: string, reason?: string | null): Promise<void>;
  cancel(tenantId: string, requestId: string): Promise<void>;
  incrementLineFulfilled(
    tenantId: string,
    lineId: string,
    quantity: number,
    tx?: StockRequestTx,
  ): Promise<void>;
  markFulfilled(
    tenantId: string,
    requestId: string,
    fulfilledBy: string,
    tx?: StockRequestTx,
  ): Promise<void>;
  recomputeStatus(tenantId: string, requestId: string, tx?: StockRequestTx): Promise<void>;
  lockLineForUpdate(
    tenantId: string,
    lineId: string,
    tx: StockRequestTx,
  ): Promise<{
    lineId: string;
    requestId: string;
    requestNumber: string;
    status: string;
    itemId: string;
    quantityRequested: number;
    quantityFulfilled: number;
    warehouseId: string | null;
    patientId: string | null;
    fulfilledBy: string | null;
  } | null>;
  findRequestIdByLineId(tenantId: string, lineId: string): Promise<string | null>;
  findLineById(tenantId: string, lineId: string): Promise<{
    lineId: string;
    requestId: string;
    requestNumber: string;
    status: string;
    itemId: string;
    quantityRequested: number;
    quantityFulfilled: number;
    warehouseId: string | null;
    patientId: string | null;
  } | null>;
  getSummaryCounts(tenantId: string): Promise<StockRequestSummaryCounts>;
}
