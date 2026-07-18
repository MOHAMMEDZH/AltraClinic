import { TwilioSmsSender } from '../infrastructure/services/twilio-sms-sender.service';

describe('TwilioSmsSender', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      TWILIO_ACCOUNT_SID: 'ACtest',
      TWILIO_AUTH_TOKEN: 'token',
      TWILIO_FROM_NUMBER: '+15551234567',
    };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => '' });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  it('posts to Twilio messages API', async () => {
    const sender = new TwilioSmsSender();
    await sender.sendInvite('+963991234567', 'Welcome');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.twilio.com/2010-04-01/Accounts/ACtest/Messages.json',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws when credentials are missing', async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    const sender = new TwilioSmsSender();
    await expect(sender.sendInvite('+1', 'Hi')).rejects.toThrow('Twilio credentials are not configured');
  });
});
