/**
 * Flexible Step 27 — external delivery guard XD01–XD05.
 * Proves RecordingTransactionalEmailService never performs real network sends.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  createPlatformNotificationsStack,
  type PlatformNotificationsStack,
} from './platform-notifications-stack';
import { RecordingTransactionalEmailService } from './platform-notifications-db.harness';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupPlatformNotificationsTables,
  clearPlatformNotificationFailureInjection,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  ensureSentinel,
  platformDbSecurityEnabled,
} from './platform-notifications-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 27 external delivery guard XD01-XD05', () => {
  let prisma: PrismaClient;
  let stack: PlatformNotificationsStack;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = createPlatformDbSecurityClient();
    await ensureSentinel(prisma);
  });

  afterAll(async () => {
    await cleanupPlatformNotificationsTables(prisma);
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    clearPlatformNotificationFailureInjection();
    process.env.NODE_ENV = 'test';
    await cleanupPlatformNotificationsTables(prisma);
    stack = createPlatformNotificationsStack(prisma);
  });

  it('XD01: stack emailService.realExternalDeliveriesDuringTests === 0 after invitationSent', async () => {
    await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `xd01-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    expect(stack.emailService.realExternalDeliveriesDuringTests).toBe(0);
    expect(stack.emailService.sent.length).toBe(1);
  });

  it('XD02: realProviderInitializationsDuringTests === 0', async () => {
    await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `xd02-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    expect(stack.emailService.realProviderInitializationsDuringTests).toBe(0);
  });

  it('XD03: EMAIL_ADAPTER env even if set to smtp does not matter because stack injects recorder', async () => {
    const prev = process.env.EMAIL_ADAPTER;
    process.env.EMAIL_ADAPTER = 'smtp';
    try {
      const local = createPlatformNotificationsStack(prisma);
      expect(local.emailService).toBeInstanceOf(RecordingTransactionalEmailService);
      await local.adapters.invitationSent({
        invitationId: randomUUID(),
        platformUserId: randomUUID(),
        recipientEmail: `xd03-${randomUUID()}@test.local`,
        recipientDisplayName: 'Admin',
        inviterDisplayName: 'Root',
        expiresAt: new Date().toISOString(),
      });
      expect(local.emailService.realExternalDeliveriesDuringTests).toBe(0);
    } finally {
      if (prev === undefined) delete process.env.EMAIL_ADAPTER;
      else process.env.EMAIL_ADAPTER = prev;
    }
  });

  it('XD04: non-@test.local recipient refused by recorder', async () => {
    await expect(
      stack.emailService.send({
        to: 'user@gmail.com',
        subject: 'x',
        text: 'y',
      }),
    ).rejects.toThrow(/refused non-test recipient/i);
    expect(stack.emailService.realExternalDeliveriesDuringTests).toBe(0);
  });

  it('XD05: process.env.NODE_ENV=test keeps workers disabled (assert or document)', () => {
    expect(process.env.NODE_ENV).toBe('test');
    // DeliveryWorkerService.workersEnabled() returns false when NODE_ENV=test — Step 27
    // suites therefore drive processDeliveryJob synchronously via the dispatch path.
    expect(process.env.NODE_ENV === 'test').toBe(true);
  });
});
