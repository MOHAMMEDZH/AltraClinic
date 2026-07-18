import { ModuleRegistryService } from '../application/module-registry.service';
import { LicensingEngineService } from '../../subscription/application/services/licensing-engine.service';
import { SettingsService } from '../../settings/application/services/settings.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { bootstrapRegistry, BUILTIN_MODULE_MANIFESTS } from '@booking/module-registry';

describe('ModuleRegistryService', () => {
  const licensingEngine = {
    getEntitlements: jest.fn(),
  } as unknown as LicensingEngineService;

  const settingsService = {
    getTenantSettings: jest.fn(),
  } as unknown as SettingsService;

  const tenantContext = {
    resolve: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
  } as unknown as TenantContextService;

  let service: ModuleRegistryService;

  beforeEach(() => {
    service = new ModuleRegistryService(licensingEngine, settingsService, tenantContext);
    service.onModuleInit();
    jest.clearAllMocks();
  });

  it('bootstraps 21 built-in manifests', () => {
    expect(service.getSnapshot().moduleCount).toBe(21);
  });

  it('resolves effective views from licensing engine only', async () => {
    (licensingEngine.getEntitlements as jest.Mock).mockResolvedValue({
      license: {
        modules: { patients: 'enabled', dashboard: 'enabled' },
        status: 'active',
      },
      canWrite: true,
      canMutate: true,
    });
    (settingsService.getTenantSettings as jest.Mock).mockResolvedValue({ moduleFlags: {} });

    const views = await service.getEffectiveModuleViews(['owner']);
    const patients = views.find((v) => v.moduleId === 'patients');
    expect(patients?.access).toBe('enabled');
    expect(licensingEngine.getEntitlements).toHaveBeenCalledWith('tenant-1');
  });

  it('intersects tenant module flags (narrow only)', async () => {
    (licensingEngine.getEntitlements as jest.Mock).mockResolvedValue({
      license: { modules: { patients: 'enabled' }, status: 'active' },
      canWrite: true,
      canMutate: true,
    });
    (settingsService.getTenantSettings as jest.Mock).mockResolvedValue({
      moduleFlags: { patients: false },
    });

    const views = await service.getEffectiveModuleViews(['owner']);
    const patients = views.find((v) => v.moduleId === 'patients');
    expect(patients?.userAccessible).toBe(false);
    expect(patients?.lockReason).toBe('flag');
  });

  it('validates built-in catalog at bootstrap', () => {
    const result = bootstrapRegistry(BUILTIN_MODULE_MANIFESTS);
    expect(result.validationErrors).toEqual([]);
  });

  it('returns entitlementVersion in bootstrap payload', async () => {
    (licensingEngine.getEntitlements as jest.Mock).mockResolvedValue({
      license: {
        modules: { dashboard: 'enabled' },
        status: 'active',
      },
      canWrite: true,
      canMutate: true,
    });
    (settingsService.getTenantSettings as jest.Mock).mockResolvedValue({ moduleFlags: {} });

    const payload = await service.getBootstrapPayload(['owner']);
    expect(payload.snapshot.entitlementVersion).toContain('active');
    expect(payload.modules.length).toBeGreaterThan(0);
  });
});
