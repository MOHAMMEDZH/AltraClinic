import { CommandHandlerInterface } from '../../common/command-handler.interface';

export abstract class BaseCommandHandler<C, R = void> implements CommandHandlerInterface<C, R> {
  abstract execute(command: C): Promise<R>;
}
