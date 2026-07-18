export class ListAiModelsQuery {
  constructor(
    public readonly branchId: string | null,
    public readonly modelType: string | null,
    public readonly status: string | null,
    public readonly limit: number,
    public readonly offset: number,
  ) {}
}
