export interface ReportFilters {
  tenantId: string;
  branchId?: string | null;
  createdBy?: string | null;
  type?: string | null;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}
