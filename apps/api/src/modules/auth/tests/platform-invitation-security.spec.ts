import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { DevMailboxPlatformInvitationDelivery } from '../infrastructure/services/dev-mailbox-platform-invitation.delivery';
import {
  PlatformInvitationDevMailbox,
  redactEmailForLogs,
} from '../infrastructure/services/platform-invitation-delivery.port';
import { ConsoleEmailSender } from '../infrastructure/services/console-email-sender.service';

describe('platform invitation secret handling', () => {
  const secretUrl =
    'http://127.0.0.1:5176/activate?token=SECRET_INVITE_TOKEN_VALUE_abc123';
  const tokenHash = 'SHOULD_NEVER_LEAK_TOKEN_HASH';

  beforeEach(() => {
    PlatformInvitationDevMailbox.clear();
  });

  afterEach(() => {
    PlatformInvitationDevMailbox.clear();
    delete process.env.PLATFORM_INVITATION_REQUIRE_SMTP;
    delete process.env.PLATFORM_INVITATION_ALLOW_DEV_MAILBOX;
    delete process.env.PLATFORM_INVITATION_DELIVERY_MODE;
    delete process.env.APP_ENV;
  });

  it('queues invitation without logging token, URL, or hash', async () => {
    const delivery = new DevMailboxPlatformInvitationDelivery();
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const result = await delivery.deliver({
      recipientEmail: 'invitee@example.com',
      activationUrl: secretUrl,
      invitationId: 'inv-1',
      platformUserId: 'user-1',
      expiresAt: new Date(Date.now() + 60_000),
      templateId: 'platform_user_invitation',
    });

    expect(result).toEqual({
      invitationId: 'inv-1',
      platformUserId: 'user-1',
      channel: 'dev_mailbox',
      deliveryStatus: 'queued',
      recipientRedacted: redactEmailForLogs('invitee@example.com'),
    });
    expect(JSON.stringify(result)).not.toContain('SECRET_INVITE_TOKEN');
    expect(JSON.stringify(result)).not.toContain(secretUrl);
    expect(JSON.stringify(result)).not.toContain(tokenHash);

    const logged = [...logSpy.mock.calls, ...errorSpy.mock.calls].map((c) => String(c[0])).join('\n');
    expect(logged).not.toContain('SECRET_INVITE_TOKEN');
    expect(logged).not.toContain(secretUrl);
    expect(logged).not.toContain('/activate?token=');
    expect(logged).not.toContain(tokenHash);
    expect(logged).toContain('invitationId=inv-1');

    const captured = PlatformInvitationDevMailbox.takeAll();
    expect(captured).toHaveLength(1);
    expect(captured[0].activationUrl).toBe(secretUrl);

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('console email sender never logs invitation URL', async () => {
    const sender = new ConsoleEmailSender();
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    await sender.sendPlatformInvitation('invitee@example.com', secretUrl);
    const logged = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).not.toContain(secretUrl);
    expect(logged).not.toContain('SECRET_INVITE_TOKEN');
    expect(logged).toContain('channel=dev_mailbox');
    logSpy.mockRestore();
  });

  it('refuses production-like console/dev mailbox fallback', async () => {
    process.env.NODE_ENV = 'production';
    process.env.APP_ENV = 'production';
    process.env.PLATFORM_INVITATION_DELIVERY_MODE = 'dev-mailbox';
    const delivery = new DevMailboxPlatformInvitationDelivery();
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    await expect(
      delivery.deliver({
        recipientEmail: 'invitee@example.com',
        activationUrl: secretUrl,
        invitationId: 'inv-2',
        platformUserId: 'user-2',
        expiresAt: new Date(),
        templateId: 'platform_user_invitation',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    const logged = errorSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).not.toContain(secretUrl);
    expect(logged).not.toContain('SECRET_INVITE_TOKEN');
    errorSpy.mockRestore();
  });

  it('delivery errors do not include token fragments', async () => {
    process.env.NODE_ENV = 'staging';
    process.env.APP_ENV = 'staging';
    process.env.PLATFORM_INVITATION_DELIVERY_MODE = 'dev-mailbox';
    const delivery = new DevMailboxPlatformInvitationDelivery();
    try {
      await delivery.deliver({
        recipientEmail: 'invitee@example.com',
        activationUrl: secretUrl,
        invitationId: 'inv-3',
        platformUserId: 'user-3',
        expiresAt: new Date(),
        templateId: 'platform_user_invitation',
      });
      fail('expected throw');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain('SECRET_INVITE_TOKEN');
      expect(message).not.toContain(secretUrl);
    }
  });
});
