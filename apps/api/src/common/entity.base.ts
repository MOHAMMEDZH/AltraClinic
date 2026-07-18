export abstract class Entity<T extends Record<string, unknown> = Record<string, unknown>> {
  protected readonly props: T;
  public readonly id: string;

  protected constructor(id: string, props: T) {
    this.id = id;
    this.props = Object.freeze({ ...props });
  }

  public equals(entity?: Entity<T>): boolean {
    if (entity === null || entity === undefined) {
      return false;
    }

    return this.id === entity.id;
  }
}
