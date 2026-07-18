import { LicensedModuleGuard } from '../api/guards/licensed-module.guard';
import { SubscriptionEnforcementService } from '../application/services/subscription-enforcement.service';
import { LicensingAuditService } from '../application/services/licensing-audit.service';
import { Reflector } from '@nestjs/core';
import { LICENSED_MODULE_KEY } from '../api/decorators/require-licensed-module.decorator';
import { LICENSED_FEATURE_KEY } from '../api/decorators/require-licensed-feature.decorator';
import { ForbiddenException } from '@nestjs/common';

describe('LicensedModuleGuard', () => {
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

  it('passes when no module metadata', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    await expect(
      guard.canActivate({
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => ({ headers: { 'x-tenant-id': 't1' }, user: { tenantId: 't1' } }) }),
      } as never),
    ).resolves.toBe(true);
  });

  it('enforces module access for decorated routes', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key: string) =>
      key === LICENSED_MODULE_KEY ? 'emr' : undefined,
    );
    (enforcement.enforceModuleAccess as jest.Mock).mockResolvedValue(undefined);

    await expect(
      guard.canActivate({
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({ headers: { 'x-tenant-id': 't1' }, user: { tenantId: 't1' } }),
        }),
      } as never),
    ).resolves.toBe(true);

    expect(enforcement.enforceModuleAccess).toHaveBeenCalledWith('t1', 'emr');
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(LICENSED_MODULE_KEY, expect.any(Array));
  });

  it('rejects tenant header mismatch before licensing', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key: string) =>
      key === LICENSED_MODULE_KEY ? 'emr' : undefined,
    );
    await expect(
      guard.canActivate({
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({ headers: { 'x-tenant-id': 't1' }, user: { tenantId: 't2' } }),
        }),
      } as never),
    ).rejects.toThrow(ForbiddenException);
  });
});
