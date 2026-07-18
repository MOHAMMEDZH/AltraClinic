export class DentalProcedure {
  constructor(
    public readonly id: string,
    public readonly code: string,
    public readonly description: string,
    public readonly toothNumbers: number[] = [],
    public readonly performedAt: string | null = null,
    public readonly providerId: string | null = null,
  ) {}
}
