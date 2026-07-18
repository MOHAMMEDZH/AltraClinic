export interface CommandHandlerInterface<C, R = void> {
  execute(command: C): Promise<R>;
}
