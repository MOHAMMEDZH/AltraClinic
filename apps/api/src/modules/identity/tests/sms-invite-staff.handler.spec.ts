import { ConflictException } from '@nestjs/common';
import { SmsInviteStaffHandler } from '../application/handlers/user-enterprise-ext.handlers';
import type { UserRole } from '../domain/user.entity';

describe('SmsInviteStaffHandler', () => {
  const tenantContext = {
    resolve: jest.fn().mockResolvedValue({ tenantId: 'tenant-1', branchId: 'branch-1' }),
  };

  const subscriptionEnforcement = {
    enforceFeature: jest.fn().mockResolvedValue(undefined),
  };

  const producer = {
    produceChannels: jest.fn().mockResolvedValue({ intentId: 'intent-1', notificationId: 'notif-1' }),
  };

  const baseInput = {
    email: 'new@demo.clinic',
    phone: '+963991234567',
    roles: ['receptionist'] as UserRole[],
    firstName: 'New',
    lastName: 'User',
    branchId: null,
    invitedBy: 'actor-1',
    invitedByRoles: ['owner'],
  };

  function handler(prisma: object, inviteHandler: object) {
    return new SmsInviteStaffHandler(
      prisma as never,
      tenantContext as never,
      inviteHandler as never,
      subscriptionEnforcement as never,
      producer as never,
    );
  }

  beforeEach(() => {
    subscriptionEnforcement.enforceFeature.mockClear();
    producer.produceChannels.mockClear();
  });

  it('requires smsInvites tenant feature flag', async () => {
    const prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ features: {} }) },
    };
    const inviteHandler = { execute: jest.fn() };
    await expect(handler(prisma, inviteHandler).execute(baseInput)).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires phone number', async () => {
    const prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ features: { smsInvites: true } }) },
    };
    const inviteHandler = { execute: jest.fn() };
    await expect(handler(prisma, inviteHandler).execute({ ...baseInput, phone: '' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('enforces plan-level smsInvites capability', async () => {
    const prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ features: { smsInvites: true } }) },
    };
    const inviteHandler = { execute: jest.fn() };
    subscriptionEnforcement.enforceFeature.mockRejectedValueOnce(new Error('plan blocked'));
    await expect(handler(prisma, inviteHandler).execute(baseInput)).rejects.toThrow('plan blocked');
    expect(subscriptionEnforcement.enforceFeature).toHaveBeenCalledWith('tenant-1', 'smsInvites');
  });

  it('produces an SMS notification intent after invite', async () => {
    const prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ features: { smsInvites: true } }) },
    };
    const inviteHandler = {
      execute: jest.fn().mockResolvedValue({ user: { id: 'user-new' }, invitationId: 'inv-1' }),
    };
    const result = await handler(prisma, inviteHandler).execute(baseInput);
    expect(result.user.id).toBe('user-new');
    expect(producer.produceChannels).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        recipientId: 'user-new',
        channels: ['sms'],
        metadata: { recipientPhone: '+963991234567' },
      }),
    );
  });
});
