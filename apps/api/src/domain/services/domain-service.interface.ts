export interface DomainServiceInterface {
  perform(...args: unknown[]): Promise<unknown>;
}
