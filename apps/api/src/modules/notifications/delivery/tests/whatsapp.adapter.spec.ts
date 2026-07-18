import { WhatsappAdapter, isTwilioWhatsAppConfigured } from '../adapters/whatsapp.adapter';
import { ProviderUnavailableError } from '../provider-adapter.contract';
import { PrismaService } from '../../../../infrastructure/prisma.service';

function makePrismaStub(phone: string | null): PrismaService {
  return {
    user: {
      findFirst: jest.fn().mockResolvedValue(phone ? { phone } : null),
    },
  } as unknown as PrismaService;
}

const ORIGINAL_ENV = { ...process.env };

describe('WhatsappAdapter', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.WHATSAPP_ADAPTER;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_WHATSAPP_FROM;
    fetchSpy = jest.spyOn(global, 'fetch' as never);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    fetchSpy.mockRestore();
  });

  describe('isTwilioWhatsAppConfigured', () => {
    it('is false with no env configured', () => {
      expect(isTwilioWhatsAppConfigured()).toBe(false);
    });

    it('is false when WHATSAPP_ADAPTER is not "twilio-content"', () => {
      process.env.WHATSAPP_ADAPTER = 'something-else';
      process.env.TWILIO_ACCOUNT_SID = 'AC123';
      process.env.TWILIO_AUTH_TOKEN = 'token';
      process.env.TWILIO_WHATSAPP_FROM = '+10000000000';
      expect(isTwilioWhatsAppConfigured()).toBe(false);
    });

    it('is false when credentials are missing even with the right adapter name', () => {
      process.env.WHATSAPP_ADAPTER = 'twilio-content';
      expect(isTwilioWhatsAppConfigured()).toBe(false);
    });

    it('is true when adapter name and all credentials are present', () => {
      process.env.WHATSAPP_ADAPTER = 'twilio-content';
      process.env.TWILIO_ACCOUNT_SID = 'AC123';
      process.env.TWILIO_AUTH_TOKEN = 'token';
      process.env.TWILIO_WHATSAPP_FROM = '+10000000000';
      expect(isTwilioWhatsAppConfigured()).toBe(true);
    });
  });

  describe('send()', () => {
    it('throws ProviderUnavailableError (never SMS) when unconfigured, and never calls fetch', async () => {
      const adapter = new WhatsappAdapter(makePrismaStub('+15550001111'));

      await expect(
        adapter.send({
          tenantId: 'tenant-1',
          recipientId: 'user-1',
          channel: 'whatsapp',
          title: 'Hello',
          body: 'Your appointment is confirmed',
        }),
      ).rejects.toThrow(ProviderUnavailableError);

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('reports unavailable (not success) when no recipient phone number is on file', async () => {
      process.env.WHATSAPP_ADAPTER = 'twilio-content';
      process.env.TWILIO_ACCOUNT_SID = 'AC123';
      process.env.TWILIO_AUTH_TOKEN = 'token';
      process.env.TWILIO_WHATSAPP_FROM = '+10000000000';

      const adapter = new WhatsappAdapter(makePrismaStub(null));

      await expect(
        adapter.send({ tenantId: 'tenant-1', recipientId: 'user-1', channel: 'whatsapp', title: 'Hi', body: 'Body' }),
      ).rejects.toThrow(ProviderUnavailableError);
    });

    it('sends via the Twilio WhatsApp content API when properly configured, never touching SMS', async () => {
      process.env.WHATSAPP_ADAPTER = 'twilio-content';
      process.env.TWILIO_ACCOUNT_SID = 'AC123';
      process.env.TWILIO_AUTH_TOKEN = 'token';
      process.env.TWILIO_WHATSAPP_FROM = '+10000000000';

      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ sid: 'SM123' }),
        text: async () => '',
      } as Response);

      const adapter = new WhatsappAdapter(makePrismaStub('+15550001111'));
      const result = await adapter.send({
        tenantId: 'tenant-1',
        recipientId: 'user-1',
        channel: 'whatsapp',
        title: 'Hi',
        body: 'Your appointment is confirmed',
      });

      expect(result.success).toBe(true);
      expect(result.providerKey).toBe('whatsapp-twilio-content');
      expect(result.externalId).toBe('SM123');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];
      expect(String(url)).toContain('api.twilio.com');
      expect(String(options.body)).toContain('whatsapp%3A');
    });

    it('surfaces a non-success result when Twilio responds with an error, without falling back to SMS', async () => {
      process.env.WHATSAPP_ADAPTER = 'twilio-content';
      process.env.TWILIO_ACCOUNT_SID = 'AC123';
      process.env.TWILIO_AUTH_TOKEN = 'token';
      process.env.TWILIO_WHATSAPP_FROM = '+10000000000';

      fetchSpy.mockResolvedValue({ ok: false, status: 500, text: async () => 'internal error' } as Response);

      const adapter = new WhatsappAdapter(makePrismaStub('+15550001111'));

      await expect(
        adapter.send({ tenantId: 'tenant-1', recipientId: 'user-1', channel: 'whatsapp', title: 'Hi', body: 'Body' }),
      ).rejects.toThrow(/Twilio WhatsApp API failed/);
    });
  });
});
