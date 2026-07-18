export class CreateWorkflowCommand {
  constructor(
    public readonly nameEn: string,
    public readonly nameAr: string,
    public readonly descriptionEn: string,
    public readonly descriptionAr: string,
    public readonly steps: string[],
    public readonly branchId: string | null,
    public readonly createdBy: string,
  ) {}
}
