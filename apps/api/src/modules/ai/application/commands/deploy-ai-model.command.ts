export class DeployAiModelCommand {
  constructor(
    public readonly modelId: string,
    public readonly deployedBy: string,
    public readonly deployedByRoles: string[],
  ) {}
}
