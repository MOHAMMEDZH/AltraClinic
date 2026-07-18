import { MessageContract } from '../../contracts/message.contract';

export interface EventTransportInterface {
  publish(message: MessageContract): Promise<void>;
  subscribe(topic: string, handler: (message: MessageContract) => Promise<void>): Promise<void>;
}
