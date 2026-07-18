import { MessageContract } from '../contracts/message.contract';

export interface MessageBusInterface {
  publish(message: MessageContract): Promise<void>;
  subscribe(topic: string, handler: (message: MessageContract) => Promise<void>): Promise<void>;
}
