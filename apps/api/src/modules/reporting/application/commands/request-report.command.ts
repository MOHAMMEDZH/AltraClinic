export class RequestReportCommand {
  constructor(
    public readonly createdBy: string,
    public readonly name: string,
    public readonly type: string,
    public readonly format: string,
    public readonly startDate: string,
    public readonly endDate: string,
    public readonly parameters: Record<string, unknown>,
    public readonly branchId?: string | null,
  ) {}
}
