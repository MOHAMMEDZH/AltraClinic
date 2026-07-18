export abstract class BaseQuery {
  public readonly queryId: string;
  public readonly occurredAt: string;

  protected constructor(queryId: string, occurredAt: string) {
    this.queryId = queryId;
    this.occurredAt = occurredAt;
  }
}
