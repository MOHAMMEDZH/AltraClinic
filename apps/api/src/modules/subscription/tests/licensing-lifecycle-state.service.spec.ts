import { LicensingLifecycleStateService } from '../application/services/licensing-lifecycle-state.service';
import { LicensingCommercialAuditService } from '../application/services/licensing-commercial-audit.service';
import { Prisma } from '@prisma/client';

describe('LicensingLifecycleStateService', () => {
  const tenantLicenseLifecycleState = {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  };
  const licenseLifecycleTransition = {
    create: jest.fn(),
  };
  /** Same object graph passed into withTenantContext(fn) as production tx. */
  const tx = {
    tenantLicenseLifecycleState,
    licenseLifecycleTransition,
  };
  const prisma = {
    withTenantContext: jest.fn(
      async (_tenantId: string, fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    ),
    tenantLicenseLifecycleState,
    licenseLifecycleTransition,
  };

  const commercialAudit = {
    recordLicenseStatusTransition: jest.fn().mockResolvedValue(undefined),
  } as unknown as LicensingCommercialAuditService;

  const svc = new LicensingLifecycleStateService(prisma as never, commercialAudit);

  beforeEach(() => jest.clearAllMocks());

  it('bootstraps persisted state on first resolve without audit', async () => {
    tenantLicenseLifecycleState.findUnique.mockResolvedValue(null);
    tenantLicenseLifecycleState.create.mockResolvedValue({});

    await svc.syncFromResolvedLicense('t1', { status: 'active', uiPlan: 'professional' });

    expect(prisma.withTenantContext).toHaveBeenCalledWith('t1', expect.any(Function));
    expect(tenantLicenseLifecycleState.create).toHaveBeenCalledWith({
      data: { tenantId: 't1', licenseStatus: 'active', uiPlan: 'professional' },
    });
    expect(commercialAudit.recordLicenseStatusTransition).not.toHaveBeenCalled();
  });

  it('records grace transition exactly once with durable ledger', async () => {
    tenantLicenseLifecycleState.findUnique.mockResolvedValue({
      tenantId: 't1',
      licenseStatus: 'active',
      uiPlan: 'professional',
    });
    licenseLifecycleTransition.create.mockResolvedValue({});
    tenantLicenseLifecycleState.update.mockResolvedValue({});

    await svc.syncFromResolvedLicense('t1', { status: 'grace', uiPlan: 'professional' });

    expect(licenseLifecycleTransition.create).toHaveBeenCalledWith({
      data: { tenantId: 't1', previousStatus: 'active', newStatus: 'grace' },
    });
    expect(commercialAudit.recordLicenseStatusTransition).toHaveBeenCalledWith(
      expect.objectContaining({ previousStatus: 'active', newStatus: 'grace' }),
    );
  });

  it('skips duplicate audit when transition ledger unique constraint fires', async () => {
    tenantLicenseLifecycleState.findUnique.mockResolvedValue({
      tenantId: 't1',
      licenseStatus: 'grace',
      uiPlan: 'professional',
    });
    licenseLifecycleTransition.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    tenantLicenseLifecycleState.update.mockResolvedValue({});

    await svc.syncFromResolvedLicense('t1', { status: 'expired', uiPlan: 'professional' });

    expect(commercialAudit.recordLicenseStatusTransition).not.toHaveBeenCalled();
    expect(tenantLicenseLifecycleState.update).toHaveBeenCalled();
  });

  it('persistKnownStatus upserts durable state', async () => {
    tenantLicenseLifecycleState.upsert.mockResolvedValue({});
    await svc.persistKnownStatus('t1', 'suspended', 'professional');
    expect(prisma.withTenantContext).toHaveBeenCalledWith('t1', expect.any(Function));
    expect(tenantLicenseLifecycleState.upsert).toHaveBeenCalled();
  });
});
