export class ListReportsQuery {
  constructor(
    public readonly branchId: string | null,
    public readonly createdBy: string | null,
    public readonly type: string | null,
    public readonly status: string | null,
    public readonly startDate: string | null,
    public readonly endDate: string | null,
  ) {}
}
