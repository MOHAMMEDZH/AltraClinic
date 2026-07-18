import { ConsoleSmsSender } from '../infrastructure/services/console-sms-sender.service';
import { TwilioSmsSender } from '../infrastructure/services/twilio-sms-sender.service';
import { isTwilioSmsConfigured, smsSenderProvider } from '../infrastructure/services/sms-sender.provider';

describe('smsSenderProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses ConsoleSmsSender when Twilio env is missing', () => {
    expect(isTwilioSmsConfigured()).toBe(false);
    const sender = smsSenderProvider.useFactory();
    expect(sender).toBeInstanceOf(ConsoleSmsSender);
  });

  it('uses TwilioSmsSender when all Twilio env vars are set', () => {
    process.env.TWILIO_ACCOUNT_SID = 'ACtest';
    process.env.TWILIO_AUTH_TOKEN = 'token';
    process.env.TWILIO_FROM_NUMBER = '+15551234567';
    expect(isTwilioSmsConfigured()).toBe(true);
    const sender = smsSenderProvider.useFactory();
    expect(sender).toBeInstanceOf(TwilioSmsSender);
  });
});
