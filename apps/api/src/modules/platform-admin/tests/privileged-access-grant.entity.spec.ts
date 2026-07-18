import { PrivilegedAccessGrant } from '../domain/entities/privileged-access-grant.entity';
import {
  PlatformAdminStateError,
  PlatformAdminValidationError,
} from '../domain/exceptions/platform-admin.exception';

describe('PrivilegedAccessGrant entity', () => {
  const future = () => new Date(Date.now() + 60 * 60 * 1000);

  function request(overrides: Partial<Parameters<typeof PrivilegedAccessGrant.request>[0]> = {}): PrivilegedAccessGrant {
    return PrivilegedAccessGrant.request({
      grantId: 'grant-1',
      adminId: 'admin-1',
      adminName: 'Ops One',
      scopes: ['support'],
      justification: 'incident triage for outage',
      expiresAt: future(),
      breakGlass: false,
      now: new Date(),
      minJustificationLength: 10,
      ...overrides,
    });
  }

  it('starts pending for a standard request', () => {
    const grant = request();
    expect(grant.status).toBe('pending_approval');
    expect(grant.isActive()).toBe(false);
  });

  it('starts active for break-glass and is flagged', () => {
    const grant = request({ breakGlass: true });
    expect(grant.status).toBe('active');
    expect(grant.breakGlass).toBe(true);
    expect(grant.isActive()).toBe(true);
  });

  it('requires a sufficiently long justification', () => {
    expect(() => request({ justification: 'short' })).toThrow(PlatformAdminValidationError);
  });

  it('requires at least one valid scope and a future expiry', () => {
    expect(() => request({ scopes: [] })).toThrow(PlatformAdminValidationError);
    expect(() => request({ expiresAt: new Date(Date.now() - 1000) })).toThrow(PlatformAdminValidationError);
  });

  it('enforces separation of duties on approval', () => {
    const grant = request();
    expect(() => grant.approve('admin-1')).toThrow(PlatformAdminValidationError);
    grant.approve('admin-2');
    expect(grant.status).toBe('active');
    expect(grant.approvedBy).toBe('admin-2');
  });

  it('cannot approve a break-glass grant', () => {
    const grant = request({ breakGlass: true });
    expect(() => grant.approve('admin-2')).toThrow(PlatformAdminStateError);
  });

  it('cannot approve an expired pending request', () => {
    const now = new Date();
    const grant = request({ expiresAt: new Date(now.getTime() + 1000), now });
    expect(() => grant.approve('admin-2', new Date(now.getTime() + 2000))).toThrow(PlatformAdminStateError);
  });

  it('rejects a pending request with separation of duties', () => {
    const grant = request();
    expect(() => grant.reject('admin-1', 'self')).toThrow(PlatformAdminValidationError);
    grant.reject('admin-2', 'not justified');
    expect(grant.status).toBe('rejected');
  });

  it('revokes an active grant and reports expiry', () => {
    const now = new Date();
    const grant = request({ breakGlass: true, expiresAt: new Date(now.getTime() + 1000), now });
    expect(grant.isActive(now)).toBe(true);
    expect(grant.effectiveStatus(new Date(now.getTime() + 2000))).toBe('expired');

    grant.revoke('no longer needed', now);
    expect(grant.status).toBe('revoked');
    expect(() => grant.revoke('again', now)).toThrow(PlatformAdminStateError);
  });

  it('reports active false once expired even when stored active', () => {
    const now = new Date();
    const grant = request({ breakGlass: true, expiresAt: new Date(now.getTime() + 1000), now });
    expect(grant.isActive(new Date(now.getTime() + 5000))).toBe(false);
  });
});
