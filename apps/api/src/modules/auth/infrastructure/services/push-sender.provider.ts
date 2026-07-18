import { PUSH_SENDER } from './push-sender.port';
import { ConsolePushSender } from './console-push-sender.service';
import { FcmPushSender } from './fcm-push-sender.service';

export function isFcmConfigured(): boolean {
  return Boolean(process.env.FCM_SERVER_KEY?.trim());
}

export const pushSenderProvider = {
  provide: PUSH_SENDER,
  useFactory: () => (isFcmConfigured() ? new FcmPushSender() : new ConsolePushSender()),
};
