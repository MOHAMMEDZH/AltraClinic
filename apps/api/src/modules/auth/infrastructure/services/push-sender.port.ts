export const PUSH_SENDER = 'PUSH_SENDER';

export interface PushSenderPort {
  sendPush(deviceToken: string, title: string, body: string, metadata?: Record<string, string>): Promise<void>;
}
