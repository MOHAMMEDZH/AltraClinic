export class ListCommissionsQuery {
  constructor(
    public readonly providerId: string | null,
    public readonly branchId: string | null,
    public readonly status: string | null,
  ) {}
}
