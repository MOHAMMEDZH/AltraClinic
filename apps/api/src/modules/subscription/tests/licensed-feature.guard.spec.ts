import { LicensedModuleGuard } from '../api/guards/licensed-module.guard';
import { SubscriptionEnforcementService } from '../application/services/subscription-enforcement.service';
import { LicensingAuditService } from '../application/services/licensing-audit.service';
import { Reflector } from '@nestjs/core';
import { LICENSED_MODULE_KEY } from '../api/decorators/require-licensed-module.decorator';
import { LICENSED_FEATURE_KEY } from '../api/decorators/require-licensed-feature.decorator';
import { PlanLimitExceededException } from '../domain/exceptions/plan-limit-exceeded.exception';

describe('LicensedModuleGuard — feature enforcement', () => {
  const enforcement = {
    enforceModuleAccess: jest.fn(),
    enforceLicensedFeature: jest.fn(),
  } as unknown as SubscriptionEnforcementService;

  const audit = {
    recordLicenseEvent: jest.fn().mockResolvedValue(undefined),
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as LicensingAuditService;

  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const guard = new LicensedModuleGuard(reflector, enforcement, audit);

  beforeEach(() => jest.clearAllMocks());

  const ctx = () =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-tenant-id': 't1' },
          user: { tenantId: 't1', sub: 'user-1' },
        }),
      }),
    }) as never;

  it('enforces licensed feature metadata', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key: string) =>
      key === LICENSED_FEATURE_KEY ? 'apiAccess' : undefined,
    );
    (enforcement.enforceLicensedFeature as jest.Mock).mockResolvedValue(undefined);

    await expect(guard.canActivate(ctx())).resolves.toBe(true);
    expect(enforcement.enforceLicensedFeature).toHaveBeenCalledWith('t1', 'apiAccess');
  });

  it('audits feature denial', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key: string) =>
      key === LICENSED_FEATURE_KEY ? 'integrations' : undefined,
    );
    (enforcement.enforceLicensedFeature as jest.Mock).mockRejectedValue(
      new PlanLimitExceededException('integrations', false, 'lite'),
    );

    await expect(guard.canActivate(ctx())).rejects.toBeInstanceOf(PlanLimitExceededException);
    expect(audit.recordLicenseEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'feature.denied', featureId: 'integrations', tenantId: 't1' }),
    );
  });
});
