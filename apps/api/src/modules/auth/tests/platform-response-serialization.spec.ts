import type { PlatformUserProps } from '../domain/entities/platform-user.entity';
import { PlatformUser } from '../domain/entities/platform-user.entity';
import { PLATFORM_PERMISSIONS, PLATFORM_ROLES } from '../platform-rbac/platform-rbac.catalog';
import {
  assertNoForbiddenPlatformFields,
  mapPlatformAdminSession,
  mapPlatformInvitationAdmin,
  mapPlatformInvitationValidation,
  mapPlatformMfaResetRequest,
  mapPlatformPermissionCatalogItem,
  mapPlatformPrincipalResponse,
  mapPlatformRoleCatalogItem,
  mapPlatformUserDetail,
  mapPlatformUserListItem,
  mapPlatformUserListResponse,
} from '../platform-rbac/platform-response.mappers';

const SENTINEL = 'SHOULD_NEVER_LEAK';

function fixtureUser(overrides: Partial<PlatformUserProps> = {}) {
  const now = new Date('2026-07-21T12:00:00.000Z');
  return PlatformUser.restore({
    id: 'user-1',
    email: 'owner@example.com',
    passwordHash: SENTINEL,
    displayName: 'Owner',
    isActive: true,
    status: 'active',
    suspendedAt: null,
    suspendedReason: null,
    suspendedById: null,
    authzRevision: 3,
    lockedUntil: null,
    failedLoginCount: 0,
    passwordChangedAt: now,
    lastLoginAt: now,
    lastLoginIp: SENTINEL,
    createdAt: now,
    updatedAt: now,
    mfaEnabled: true,
    mfaSecretEncrypted: SENTINEL,
    mfaKeyVersion: SENTINEL,
    mfaPendingSecretEncrypted: SENTINEL,
    mfaPendingExpiresAt: null,
    mfaConfirmedAt: now,
    lastTotpStep: SENTINEL,
    failedMfaCount: 0,
    ...overrides,
  });
}

describe('platform response serialization', () => {
  it('maps list, detail, and principal without forbidden fields', () => {
    const user = fixtureUser();
    const list = mapPlatformUserListResponse({
      items: [mapPlatformUserListItem(user, { roleKeys: ['platform_owner'], activeSessionCount: 1 })],
      page: 1,
      pageSize: 25,
      total: 1,
    });
    const detail = mapPlatformUserDetail(user, { roleKeys: ['platform_owner'], activeSessionCount: 1 });
    const me = mapPlatformPrincipalResponse({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      accountStatus: 'active',
      status: user.status,
      sessionId: 'sess-1',
      mfaEnabled: true,
      roleKeys: ['platform_owner'],
      permissions: ['platform-user.view'],
      authzRevision: 3,
    });

    for (const payload of [list, detail, me]) {
      const json = JSON.stringify(payload);
      assertNoForbiddenPlatformFields(json, SENTINEL);
      expect(json).not.toContain(SENTINEL);
      expect(payload).not.toHaveProperty('passwordHash');
      expect(payload).not.toHaveProperty('mfaSecretEncrypted');
    }

    expect(list).toEqual({
      items: [
        {
          id: 'user-1',
          email: 'owner@example.com',
          displayName: 'Owner',
          status: 'active',
          mfaEnabled: true,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          roleKeys: ['platform_owner'],
          activeSessionCount: 1,
          invitationStatus: null,
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
    });
  });

  it('maps invitation, session, MFA-reset, and catalog responses safely', () => {
    const invitation = mapPlatformInvitationAdmin({
      invitationId: 'inv-1',
      platformUserId: 'user-2',
      status: 'pending',
      expiresAt: new Date('2026-07-22T00:00:00.000Z'),
      createdAt: new Date('2026-07-21T00:00:00.000Z'),
      delivery: {
        invitationId: 'inv-1',
        platformUserId: 'user-2',
        channel: 'dev_mailbox',
        deliveryStatus: 'queued',
        recipientRedacted: 'i***@example.com',
      },
    });
    const validation = mapPlatformInvitationValidation({
      valid: true,
      expired: false,
      canActivate: true,
      emailHint: 'i***@example.com',
    });
    const session = mapPlatformAdminSession({
      sessionId: 'sess-1',
      createdAt: new Date(),
      lastInteractiveActivityAt: new Date(),
      deviceSummary: 'Chrome on Windows',
      deviceCategory: 'desktop',
    });
    const reset = mapPlatformMfaResetRequest({
      id: 'reset-1',
      targetUserId: 'user-2',
      requesterId: 'user-1',
      status: 'pending',
      reason: 'lost device',
      createdAt: new Date(),
      expiresAt: new Date(),
    });
    const roles = PLATFORM_ROLES.map(mapPlatformRoleCatalogItem);
    const permissions = PLATFORM_PERMISSIONS.map(mapPlatformPermissionCatalogItem);

    for (const payload of [invitation, validation, session, reset, roles, permissions]) {
      const json = JSON.stringify(payload);
      assertNoForbiddenPlatformFields(json, SENTINEL);
      expect(json).not.toContain('tokenHash');
      expect(json).not.toContain('activationUrl');
      expect(json).not.toContain('userAgent');
      expect(json).not.toContain('ipAddress');
    }

    expect(invitation).toEqual({
      invitationId: 'inv-1',
      platformUserId: 'user-2',
      status: 'pending',
      expiresAt: new Date('2026-07-22T00:00:00.000Z'),
      deliveryChannel: 'dev_mailbox',
      deliveryStatus: 'queued',
      createdAt: new Date('2026-07-21T00:00:00.000Z'),
    });
  });

  it('ignores unexpected persistence fields on mapped objects', () => {
    const dirty = {
      id: 'reset-2',
      targetUserId: 't',
      requesterId: 'r',
      status: 'pending',
      reason: 'x',
      createdAt: new Date(),
      expiresAt: new Date(),
      passwordHash: SENTINEL,
      mfaSecretEncrypted: SENTINEL,
      invitationTokenHash: SENTINEL,
      rawUserAgent: SENTINEL,
      familyId: SENTINEL,
    };
    const mapped = mapPlatformMfaResetRequest(dirty as any);
    const json = JSON.stringify(mapped);
    expect(json).not.toContain(SENTINEL);
    expect(mapped).not.toHaveProperty('passwordHash');
    expect(Object.keys(mapped).sort()).toEqual(
      [
        'approverId',
        'completedAt',
        'createdAt',
        'decidedAt',
        'expiresAt',
        'externalRef',
        'id',
        'reason',
        'requesterId',
        'riskClassification',
        'status',
        'targetUserId',
      ].sort(),
    );
  });
});
