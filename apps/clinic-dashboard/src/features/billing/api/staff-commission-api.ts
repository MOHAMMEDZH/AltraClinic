import { apiRequest } from '@/lib/api-client';

/** Wave F AR-22 owner report (api.staff-commission export). Read-only. */
export interface StaffCommissionOwnerCurrencyBucket {
  currency: string;
  attributedRevenue: string;
  earned: string;
  settled: string;
  outstanding: string;
  reversed: string;
  net: string;
  rowCount: number;
}

export interface StaffCommissionOwnerReport {
  from: string;
  to: string;
  byCurrency: StaffCommissionOwnerCurrencyBucket[];
  rowCount: number;
}

export async function fetchStaffCommissionOwnerReport(
  token: string,
  tenantId: string,
  params: { from: string; to: string },
): Promise<StaffCommissionOwnerReport> {
  const qs = new URLSearchParams({ from: params.from, to: params.to });
  const data = await apiRequest<StaffCommissionOwnerReport>(
    `/workforce-commercials/owner-report?${qs.toString()}`,
    { token, tenantId },
  );
  return {
    from: String(data.from ?? params.from),
    to: String(data.to ?? params.to),
    rowCount: Number(data.rowCount ?? 0),
    byCurrency: (data.byCurrency ?? []).map((row) => ({
      currency: String(row.currency),
      attributedRevenue: String(row.attributedRevenue ?? '0'),
      earned: String(row.earned ?? '0'),
      settled: String(row.settled ?? '0'),
      outstanding: String(row.outstanding ?? '0'),
      reversed: String(row.reversed ?? '0'),
      net: String(row.net ?? '0'),
      rowCount: Number(row.rowCount ?? 0),
    })),
  };
}
