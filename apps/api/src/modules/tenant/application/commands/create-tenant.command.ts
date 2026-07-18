export class CreateTenantCommand {
  constructor(public readonly name: string, public readonly domain?: string, public readonly timezone?: string) {}
}
