/**
 * Application-level invitation + serialization + delivery boundary scenarios
 * that do not require a live database.
 */
import { createHash, randomBytes } from 'crypto';
import { DevMailboxPlatformInvitationDelivery } from '../infrastructure/services/dev-mailbox-platform-invitation.delivery';
import { PlatformInvitationDevMailbox } from '../infrastructure/services/platform-invitation-delivery.port';
import {
  mapPlatformInvitationAdmin,
  mapPlatformInvitationValidation,
  mapPlatformInvitationAccept,
  assertNoForbiddenPlatformFields,
} from '../platform-rbac/platform-response.mappers';

describe('platform invitation lifecycle application scenarios', () => {
  beforeEach(() => PlatformInvitationDevMailbox.clear());
  afterEach(() => PlatformInvitationDevMailbox.clear());

  it('persists only a hash conceptually and returns safe admin DTO', async () => {
    const raw = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    const activationUrl = `http://127.0.0.1:5176/activate?token=${encodeURIComponent(raw)}`;
    const delivery = new DevMailboxPlatformInvitationDelivery();
    const result = await delivery.deliver({
      recipientEmail: 'new@example.com',
      activationUrl,
      invitationId: 'inv-lifecycle-1',
      platformUserId: 'user-new',
      expiresAt: new Date(Date.now() + 60_000),
      templateId: 'platform_user_invitation',
    });

    const admin = mapPlatformInvitationAdmin({
      invitationId: 'inv-lifecycle-1',
      platformUserId: 'user-new',
      status: 'pending',
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      delivery: result,
    });

    const json = JSON.stringify(admin);
    assertNoForbiddenPlatformFields(json);
    expect(json).not.toContain(raw);
    expect(json).not.toContain(activationUrl);
    expect(json).not.toContain(tokenHash);
    expect(PlatformInvitationDevMailbox.peekAll()[0].activationUrl).toContain(raw);
  });

  it('validation and accept DTOs exclude token hash and invitation internals', () => {
    const validation = mapPlatformInvitationValidation({
      valid: false,
      expired: true,
      canActivate: false,
    });
    const accept = mapPlatformInvitationAccept({
      preauthToken: 'preauth.jwt.placeholder',
      expiresIn: 900,
    });
    expect(validation).toEqual({ valid: false, expired: true, canActivate: false });
    expect(accept.kind).toBe('mfa_enrollment_required');
    expect(JSON.stringify(validation)).not.toContain('tokenHash');
    expect(JSON.stringify(accept)).not.toContain('password');
    expect(JSON.stringify(accept)).not.toContain('refresh');
  });

  it('resend supersession model: previous raw token is not retained in delivery result', async () => {
    const delivery = new DevMailboxPlatformInvitationDelivery();
    const firstRaw = 'FIRST_TOKEN_VALUE';
    const secondRaw = 'SECOND_TOKEN_VALUE';
    await delivery.deliver({
      recipientEmail: 'a@example.com',
      activationUrl: `http://x/activate?token=${firstRaw}`,
      invitationId: 'inv-a',
      platformUserId: 'u',
      expiresAt: new Date(),
      templateId: 'platform_user_invitation',
    });
    const second = await delivery.deliver({
      recipientEmail: 'a@example.com',
      activationUrl: `http://x/activate?token=${secondRaw}`,
      invitationId: 'inv-b',
      platformUserId: 'u',
      expiresAt: new Date(),
      templateId: 'platform_user_invitation',
    });
    expect(JSON.stringify(second)).not.toContain(firstRaw);
    expect(JSON.stringify(second)).not.toContain(secondRaw);
    const mailbox = PlatformInvitationDevMailbox.takeAll();
    expect(mailbox).toHaveLength(2);
    expect(mailbox[0].activationUrl).toContain(firstRaw);
    expect(mailbox[1].activationUrl).toContain(secondRaw);
  });
});
