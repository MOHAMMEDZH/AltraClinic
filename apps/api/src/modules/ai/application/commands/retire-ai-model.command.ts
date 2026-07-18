export class RetireAiModelCommand {
  constructor(
    public readonly modelId: string,
    public readonly retiredBy: string,
    public readonly retiredByRoles: string[],
  ) {}
}
