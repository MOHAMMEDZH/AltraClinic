export interface QueryHandlerInterface<Q, R> {
  execute(query: Q): Promise<R>;
}
