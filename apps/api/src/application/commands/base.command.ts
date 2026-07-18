export abstract class BaseCommand {
  public readonly commandId: string;
  public readonly occurredAt: string;

  protected constructor(commandId: string, occurredAt: string) {
    this.commandId = commandId;
    this.occurredAt = occurredAt;
  }
}
