import { CommunicationDispatchService } from '../application/services/communication-dispatch.service';
import { LicensingEngineService } from '../application/services/licensing-engine.service';
import { LicensingAuditService } from '../application/services/licensing-audit.service';
import { UNLIMITED } from '../domain/config/plan-limits.config';
import { CommunicationLimitExceededException } from '../domain/exceptions/communication-limit-exceeded.exception';

const TENANT = 'tenant-comm-1';

function makeLicense(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT,
    status: 'active',
    readOnly: false,
    effectiveLimits: {
      planName: 'lite',
      maxEmailPerMonth: 2,
      maxSmsPerMonth: 2,
      maxWhatsappPerMonth: 0,
      maxPushPerMonth: 5,
      ...overrides,
    },
  };
}

function makePrisma(ledgerCount = 0, existingNotificationId?: string) {
  const ledger = {
    count: jest.fn().mockResolvedValue(ledgerCount),
    findUnique: jest.fn().mockImplementation(({ where }: { where: { notificationId: string } }) =>
      existingNotificationId && where.notificationId === existingNotificationId
        ? { id: 'ledger-1' }
        : null,
    ),
    create: jest.fn().mockResolvedValue({ id: 'ledger-new' }),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  return {
    communicationDispatchLedger: ledger,
    _ledger: ledger,
  } as unknown as import('../../../infrastructure/prisma.service').PrismaService & {
    _ledger: typeof ledger;
  };
}

describe('CommunicationDispatchService', () => {
  const licensing = { resolveLicense: jest.fn() } as unknown as LicensingEngineService;
  const audit = { recordLicenseEvent: jest.fn().mockResolvedValue(undefined) } as unknown as LicensingAuditService;

  beforeEach(() => jest.clearAllMocks());

  it('allows send under limit', async () => {
    (licensing.resolveLicense as jest.Mock).mockResolvedValue(makeLicense());
    const prisma = makePrisma(1);
    const svc = new CommunicationDispatchService(prisma, licensing, audit);

    await expect(svc.assertCanDispatch(TENANT, 'EMAIL', 'n1')).resolves.toBeUndefined();
  });

  it('allows exact-limit send (current = limit - 1)', async () => {
    (licensing.resolveLicense as jest.Mock).mockResolvedValue(makeLicense({ maxSmsPerMonth: 3 }));
    const prisma = makePrisma(2);
    const svc = new CommunicationDispatchService(prisma, licensing, audit);

    await expect(svc.assertCanDispatch(TENANT, 'SMS', 'n2')).resolves.toBeUndefined();
  });

  it('blocks over-limit send', async () => {
    (licensing.resolveLicense as jest.Mock).mockResolvedValue(makeLicense({ maxEmailPerMonth: 2 }));
    const prisma = makePrisma(2);
    const svc = new CommunicationDispatchService(prisma, licensing, audit);

    await expect(svc.assertCanDispatch(TENANT, 'EMAIL', 'n3')).rejects.toBeInstanceOf(
      CommunicationLimitExceededException,
    );
    expect(audit.recordLicenseEvent).toHaveBeenCalled();
  });

  it('allows unlimited plan', async () => {
    (licensing.resolveLicense as jest.Mock).mockResolvedValue(
      makeLicense({ maxPushPerMonth: UNLIMITED, planName: 'enterprise' }),
    );
    const prisma = makePrisma(9999);
    const svc = new CommunicationDispatchService(prisma, licensing, audit);

    await expect(svc.assertCanDispatch(TENANT, 'PUSH', 'n4')).resolves.toBeUndefined();
  });

  it('is idempotent on retry when ledger exists', async () => {
    (licensing.resolveLicense as jest.Mock).mockResolvedValue(makeLicense());
    const prisma = makePrisma(2, 'n5');
    const svc = new CommunicationDispatchService(prisma, licensing, audit);

    await expect(svc.assertCanDispatch(TENANT, 'EMAIL', 'n5')).resolves.toBeUndefined();
    await svc.commitDispatch(TENANT, 'EMAIL', 'n5');
    expect(prisma._ledger.create).not.toHaveBeenCalled();
  });

  it('blocks during grace period', async () => {
    (licensing.resolveLicense as jest.Mock).mockResolvedValue({
      ...makeLicense(),
      status: 'grace',
      readOnly: true,
    });
    const prisma = makePrisma(0);
    const svc = new CommunicationDispatchService(prisma, licensing, audit);

    await expect(svc.assertCanDispatch(TENANT, 'SMS', 'n6')).rejects.toBeInstanceOf(
      CommunicationLimitExceededException,
    );
  });

  it('commits dispatch once', async () => {
    (licensing.resolveLicense as jest.Mock).mockResolvedValue(makeLicense());
    const prisma = makePrisma(0);
    const svc = new CommunicationDispatchService(prisma, licensing, audit);

    await svc.commitDispatch(TENANT, 'EMAIL', 'n7');
    expect(prisma._ledger.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ notificationId: 'n7', channel: 'EMAIL' }) }),
    );
  });
});
