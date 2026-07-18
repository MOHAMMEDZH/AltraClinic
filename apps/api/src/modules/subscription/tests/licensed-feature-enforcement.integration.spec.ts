import { Test } from '@nestjs/testing';
import { LicensedModuleGuard } from '../api/guards/licensed-module.guard';
import { SubscriptionEnforcementService } from '../application/services/subscription-enforcement.service';
import { LicensingAuditService } from '../application/services/licensing-audit.service';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PlanLimitExceededException } from '../domain/exceptions/plan-limit-exceeded.exception';
import { LICENSED_FEATURE_KEY } from '../api/decorators/require-licensed-feature.decorator';

describe('LicensedModuleGuard — feature enforcement', () => {
  const enforcement = {
    enforceModuleAccess: jest.fn(),
    enforceLicensedFeature: jest.fn(),
  } as unknown as SubscriptionEnforcementService;

  const audit = {
    recordLicenseEvent: jest.fn().mockResolvedValue(undefined),
    record: jest.fn(),
  } as unknown as LicensingAuditService;

  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const guard = new LicensedModuleGuard(reflector, enforcement, audit);

  function ctx(): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { sub: 'u1', tenantId: 't1' },
          headers: { 'x-tenant-id': 't1' },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;
  }

  beforeEach(() => jest.clearAllMocks());

  it('blocks unlicensed customRoles feature with audit', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key: string) =>
      key === LICENSED_FEATURE_KEY ? 'customRoles' : undefined,
    );
    (enforcement.enforceLicensedFeature as jest.Mock).mockRejectedValue(
      new PlanLimitExceededException('customRoles', false, 'lite'),
    );

    await expect(guard.canActivate(ctx())).rejects.toBeInstanceOf(PlanLimitExceededException);
    expect(audit.recordLicenseEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'feature.denied', featureId: 'customRoles' }),
    );
  });

  it('allows licensed whiteLabel feature check path', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key: string) =>
      key === LICENSED_FEATURE_KEY ? 'whiteLabel' : undefined,
    );
    (enforcement.enforceLicensedFeature as jest.Mock).mockResolvedValue(undefined);

    await expect(guard.canActivate(ctx())).resolves.toBe(true);
  });
});
