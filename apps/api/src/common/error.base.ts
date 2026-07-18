export abstract class BaseError extends Error {
  public readonly code: string;
  public readonly metadata?: Record<string, unknown>;

  protected constructor(code: string, message: string, metadata?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.metadata = metadata;
  }
}
