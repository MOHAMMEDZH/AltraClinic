import { RealtimeAuthorizationService } from '../application/services/realtime-authorization.service';
import { RealtimeSocketUser } from '../domain/realtime.types';
import { LicensingExecutionGuard } from '../../subscription/application/services/licensing-execution.guard';

const baseUser = (roles: string[]): RealtimeSocketUser => ({
  sub: 'user-1',
  tenantId: 'tenant-1',
  branchId: null,
  roles,
  sessionId: 'sess-1',
});

describe('RealtimeAuthorizationService', () => {
  let svc: RealtimeAuthorizationService;
  const licensing = {
    isModuleActive: jest.fn().mockResolvedValue(true),
  } as unknown as LicensingExecutionGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    (licensing.isModuleActive as jest.Mock).mockResolvedValue(true);
    svc = new RealtimeAuthorizationService(licensing);
  });

  it('allows super_admin on all channels', () => {
    expect(svc.canSubscribe(baseUser(['super_admin']), 'queue')).toBe(true);
    expect(svc.canSubscribe(baseUser(['super_admin']), 'dashboard')).toBe(true);
    expect(svc.canSubscribe(baseUser(['super_admin']), 'patients')).toBe(true);
  });

  it('allows receptionist to subscribe to queue', () => {
    expect(svc.canSubscribe(baseUser(['receptionist']), 'queue')).toBe(true);
  });

  it('denies patient from queue channel', () => {
    expect(svc.canSubscribe(baseUser(['patient']), 'queue')).toBe(false);
  });

  it('allows doctor to subscribe to appointments and patients', () => {
    expect(svc.canSubscribe(baseUser(['doctor']), 'appointments')).toBe(true);
    expect(svc.canSubscribe(baseUser(['patient']), 'patients')).toBe(false);
    expect(svc.canSubscribe(baseUser(['doctor']), 'patients')).toBe(true);
  });

  it('filters allowed channels from a mixed request', async () => {
    const allowed = await svc.filterAllowedChannels(baseUser(['receptionist']), [
      'queue',
      'dashboard',
      'patients',
    ]);
    expect(allowed).toContain('queue');
    expect(allowed).not.toContain('dashboard');
  });
});
