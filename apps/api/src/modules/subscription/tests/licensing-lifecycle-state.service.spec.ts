import { LicensingLifecycleStateService } from '../application/services/licensing-lifecycle-state.service';
import { LicensingCommercialAuditService } from '../application/services/licensing-commercial-audit.service';
import { Prisma } from '@prisma/client';

describe('LicensingLifecycleStateService', () => {
  const prisma = {
    tenantLicenseLifecycleState: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    licenseLifecycleTransition: {
      create: jest.fn(),
    },
  };

  const commercialAudit = {
    recordLicenseStatusTransition: jest.fn().mockResolvedValue(undefined),
  } as unknown as LicensingCommercialAuditService;

  const svc = new LicensingLifecycleStateService(prisma as never, commercialAudit);

  beforeEach(() => jest.clearAllMocks());

  it('bootstraps persisted state on first resolve without audit', async () => {
    prisma.tenantLicenseLifecycleState.findUnique.mockResolvedValue(null);
    prisma.tenantLicenseLifecycleState.create.mockResolvedValue({});

    await svc.syncFromResolvedLicense('t1', { status: 'active', uiPlan: 'professional' });

    expect(prisma.tenantLicenseLifecycleState.create).toHaveBeenCalledWith({
      data: { tenantId: 't1', licenseStatus: 'active', uiPlan: 'professional' },
    });
    expect(commercialAudit.recordLicenseStatusTransition).not.toHaveBeenCalled();
  });

  it('records grace transition exactly once with durable ledger', async () => {
    prisma.tenantLicenseLifecycleState.findUnique.mockResolvedValue({
      tenantId: 't1',
      licenseStatus: 'active',
      uiPlan: 'professional',
    });
    prisma.licenseLifecycleTransition.create.mockResolvedValue({});
    prisma.tenantLicenseLifecycleState.update.mockResolvedValue({});

    await svc.syncFromResolvedLicense('t1', { status: 'grace', uiPlan: 'professional' });

    expect(prisma.licenseLifecycleTransition.create).toHaveBeenCalledWith({
      data: { tenantId: 't1', previousStatus: 'active', newStatus: 'grace' },
    });
    expect(commercialAudit.recordLicenseStatusTransition).toHaveBeenCalledWith(
      expect.objectContaining({ previousStatus: 'active', newStatus: 'grace' }),
    );
  });

  it('skips duplicate audit when transition ledger unique constraint fires', async () => {
    prisma.tenantLicenseLifecycleState.findUnique.mockResolvedValue({
      tenantId: 't1',
      licenseStatus: 'grace',
      uiPlan: 'professional',
    });
    prisma.licenseLifecycleTransition.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    prisma.tenantLicenseLifecycleState.update.mockResolvedValue({});

    await svc.syncFromResolvedLicense('t1', { status: 'expired', uiPlan: 'professional' });

    expect(commercialAudit.recordLicenseStatusTransition).not.toHaveBeenCalled();
    expect(prisma.tenantLicenseLifecycleState.update).toHaveBeenCalled();
  });

  it('persistKnownStatus upserts durable state', async () => {
    prisma.tenantLicenseLifecycleState.upsert.mockResolvedValue({});
    await svc.persistKnownStatus('t1', 'suspended', 'professional');
    expect(prisma.tenantLicenseLifecycleState.upsert).toHaveBeenCalled();
  });
});
