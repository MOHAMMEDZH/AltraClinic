export class ValidateAiModelCommand {
  constructor(
    public readonly modelId: string,
    public readonly validatedBy: string,
    public readonly validatedByRoles: string[],
    public readonly notes: string | null,
  ) {}
}
