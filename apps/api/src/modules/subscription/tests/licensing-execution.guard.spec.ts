import { LicensingExecutionGuard } from '../application/services/licensing-execution.guard';
import { LicensingEngineService } from '../application/services/licensing-engine.service';
import { LicensingAuditService } from '../application/services/licensing-audit.service';

describe('LicensingExecutionGuard', () => {
  const licensing = {
    resolveLicense: jest.fn(),
  } as unknown as LicensingEngineService;

  const audit = {
    recordLicenseEvent: jest.fn().mockResolvedValue(undefined),
  } as unknown as LicensingAuditService;

  const guard = new LicensingExecutionGuard(licensing, audit);

  beforeEach(() => jest.clearAllMocks());

  it('returns false when module is disabled', async () => {
    (licensing.resolveLicense as jest.Mock).mockResolvedValue({
      readOnly: false,
      status: 'active',
      modules: { inventory: 'disabled' },
      features: {},
    });

    await expect(guard.isModuleActive('t1', 'inventory')).resolves.toBe(false);
  });

  it('returns true when module is enabled', async () => {
    (licensing.resolveLicense as jest.Mock).mockResolvedValue({
      readOnly: false,
      status: 'active',
      modules: { notifications: 'enabled' },
      features: {},
    });

    await expect(guard.isModuleActive('t1', 'notifications')).resolves.toBe(true);
  });

  it('returns false when license is suspended', async () => {
    (licensing.resolveLicense as jest.Mock).mockResolvedValue({
      readOnly: true,
      status: 'suspended',
      modules: { workflow: 'enabled' },
      features: {},
    });

    await expect(guard.isModuleActive('t1', 'workflow')).resolves.toBe(false);
  });

  it('denies worker when tenant is expired', async () => {
    (licensing.resolveLicense as jest.Mock).mockResolvedValue({
      readOnly: true,
      status: 'expired',
      modules: { notifications: 'enabled' },
      features: {},
    });

    const allowed = await guard.allowWorkerExecution({
      tenantId: 't1',
      workerName: 'test-worker',
      moduleId: 'notifications',
    });

    expect(allowed).toBe(false);
    expect(audit.recordLicenseEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'worker.denied', decision: 'denied' }),
    );
  });

  it('allows worker when module and status are valid', async () => {
    (licensing.resolveLicense as jest.Mock).mockResolvedValue({
      readOnly: false,
      status: 'active',
      modules: { notifications: 'enabled' },
      features: { integrations: 'enabled' },
    });

    const allowed = await guard.allowWorkerExecution({
      tenantId: 't1',
      workerName: 'test-worker',
      moduleId: 'notifications',
      featureId: 'integrations',
    });

    expect(allowed).toBe(true);
    expect(audit.recordLicenseEvent).not.toHaveBeenCalled();
  });
});
