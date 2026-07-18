import { LicensedModuleGuard } from '../../modules/subscription/api/guards/licensed-module.guard';
import { SubscriptionEnforcementService } from '../../modules/subscription/application/services/subscription-enforcement.service';
import { LicensingAuditService } from '../../modules/subscription/application/services/licensing-audit.service';
import { LICENSED_MODULE_KEY } from '../../modules/subscription/api/decorators/require-licensed-module.decorator';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';

describe('LicensedModuleGuard — plan bypass prevention', () => {
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

  const ctx = (tenantHeader: string, jwtTenant: string) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-tenant-id': tenantHeader },
          user: { tenantId: jwtTenant },
        }),
      }),
    }) as never;

  it('blocks EMR when enforcement rejects module', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key: string) =>
      key === LICENSED_MODULE_KEY ? 'emr' : undefined,
    );
    (enforcement.enforceModuleAccess as jest.Mock).mockRejectedValue(
      new ForbiddenException('Module not licensed'),
    );

    await expect(guard.canActivate(ctx('t1', 't1'))).rejects.toThrow(ForbiddenException);
    expect(enforcement.enforceModuleAccess).toHaveBeenCalledWith('t1', 'emr');
  });

  it('blocks AI routes for unlicensed tenants', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key: string) =>
      key === LICENSED_MODULE_KEY ? 'ai' : undefined,
    );
    (enforcement.enforceModuleAccess as jest.Mock).mockRejectedValue(
      new ForbiddenException('Module not licensed'),
    );

    await expect(guard.canActivate(ctx('t1', 't1'))).rejects.toThrow(ForbiddenException);
    expect(enforcement.enforceModuleAccess).toHaveBeenCalledWith('t1', 'ai');
  });

  it('rejects cross-tenant header spoofing before licensing check', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key: string) =>
      key === LICENSED_MODULE_KEY ? 'analytics' : undefined,
    );
    await expect(guard.canActivate(ctx('tenant-a', 'tenant-b'))).rejects.toThrow(ForbiddenException);
    expect(enforcement.enforceModuleAccess).not.toHaveBeenCalled();
  });
});
