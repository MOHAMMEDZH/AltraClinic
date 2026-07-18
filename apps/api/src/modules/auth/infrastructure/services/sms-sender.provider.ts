import { SMS_SENDER } from './sms-sender.port';
import { ConsoleSmsSender } from './console-sms-sender.service';
import { TwilioSmsSender } from './twilio-sms-sender.service';

export function isTwilioSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_FROM_NUMBER?.trim(),
  );
}

export const smsSenderProvider = {
  provide: SMS_SENDER,
  useFactory: () => (isTwilioSmsConfigured() ? new TwilioSmsSender() : new ConsoleSmsSender()),
};
