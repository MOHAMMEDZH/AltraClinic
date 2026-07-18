import { NotificationProcessorService } from '../application/services/notification-processor.service';

describe('NotificationProcessorService', () => {
  const prisma = {
    getRootClient: jest.fn(),
    notification: {
      findMany: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue({ email: 'user@demo.clinic', phone: '+963991234567' }),
    },
    userDeviceToken: {
      findMany: jest.fn().mockResolvedValue([{ token: 'device-token-1' }]),
    },
  };
  prisma.getRootClient.mockReturnValue(prisma);

  const tenantExecution = {
    runAsTenant: jest.fn((_tenantId: string, fn: () => Promise<unknown>) => fn()),
  };

  const email = { send: jest.fn().mockResolvedValue(undefined) };
  const sms = { sendInvite: jest.fn().mockResolvedValue(undefined) };
  const push = { sendPush: jest.fn().mockResolvedValue(undefined) };

  const licensing = {
    allowWorkerExecution: jest.fn().mockResolvedValue(true),
  };
  const communicationLimits = {
    isAlreadyCommitted: jest.fn().mockResolvedValue(false),
    assertCanDispatch: jest.fn().mockResolvedValue(undefined),
    commitDispatch: jest.fn().mockResolvedValue(undefined),
  };

  const svc = new NotificationProcessorService(
    prisma as never,
    tenantExecution as never,
    email as never,
    sms as never,
    push as never,
    licensing as never,
    communicationLimits as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('delivers in-app notifications', async () => {
    prisma.notification.findMany.mockResolvedValue([
      {
        id: 'n1',
        tenantId: 't1',
        branchId: null,
        recipientId: 'u1',
        channel: 'IN_APP',
        priority: 'HIGH',
        title: 'Test',
        body: 'Body',
        metadata: null,
      },
    ]);

    const result = await svc.processQueued();
    expect(result.processed).toBe(1);
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'n1' },
        data: expect.objectContaining({ status: 'DELIVERED' }),
      }),
    );
  });

  it('delivers email notifications when recipient exists', async () => {
    prisma.notification.findMany.mockResolvedValue([
      {
        id: 'n2',
        tenantId: 't1',
        branchId: null,
        recipientId: 'u1',
        channel: 'EMAIL',
        priority: 'MEDIUM',
        title: 'Email',
        body: 'Body',
        metadata: null,
      },
    ]);

    const result = await svc.processQueued();
    expect(result.processed).toBe(1);
    expect(email.send).toHaveBeenCalled();
    expect(communicationLimits.commitDispatch).toHaveBeenCalledWith('t1', 'EMAIL', 'n2');
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DELIVERED' }),
      }),
    );
  });

  it('marks EMAIL as FAILED when no recipient address', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({ email: null, phone: null });
    prisma.notification.findMany.mockResolvedValue([
      {
        id: 'n2b',
        tenantId: 't1',
        branchId: null,
        recipientId: 'u1',
        channel: 'EMAIL',
        priority: 'MEDIUM',
        title: 'Email',
        body: 'Body',
        metadata: null,
      },
    ]);

    const result = await svc.processQueued();
    expect(result.failed).toBe(1);
    expect(email.send).not.toHaveBeenCalled();
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
  });

  it('delivers SMS notifications via sender', async () => {
    prisma.notification.findMany.mockResolvedValue([
      {
        id: 'n3',
        tenantId: 't1',
        branchId: null,
        recipientId: 'u1',
        channel: 'SMS',
        priority: 'MEDIUM',
        title: 'Invite',
        body: 'Welcome',
        metadata: { recipientPhone: '+963991234567' },
      },
    ]);

    const result = await svc.processQueued();
    expect(result.processed).toBe(1);
    expect(sms.sendInvite).toHaveBeenCalledWith('+963991234567', 'Welcome');
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DELIVERED' }),
      }),
    );
  });

  it('marks SMS as FAILED when no phone number', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({ email: null, phone: null });
    prisma.notification.findMany.mockResolvedValue([
      {
        id: 'n3b',
        tenantId: 't1',
        branchId: null,
        recipientId: 'u1',
        channel: 'SMS',
        priority: 'MEDIUM',
        title: 'Invite',
        body: 'Welcome',
        metadata: null,
      },
    ]);

    const result = await svc.processQueued();
    expect(result.failed).toBe(1);
    expect(sms.sendInvite).not.toHaveBeenCalled();
  });
});
