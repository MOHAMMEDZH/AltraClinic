import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PatientPortalPermissionGuard } from '../api/patient-portal-permission.guard';
import { PatientPortalPolicy } from '../policies/patient-portal-policy.service';

describe('PatientPortalPermissionGuard', () => {
  const guard = new PatientPortalPermissionGuard(new PatientPortalPolicy());

  function contextWith(request: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  it('allows an authenticated staff user and normalizes roles', () => {
    const request: Record<string, unknown> = { user: { id: 'u1', roles: ['Receptionist'] } };
    expect(guard.canActivate(contextWith(request))).toBe(true);
    expect((request.user as { roles: string[] }).roles).toEqual(['receptionist']);
  });

  it('allows a patient user', () => {
    expect(guard.canActivate(contextWith({ user: { id: 'p1', roles: ['patient'] } }))).toBe(true);
  });

  it('rejects header-only identity and requires request.user from trusted auth middleware', () => {
    const request: Record<string, unknown> = {
      headers: { 'x-user-id': 'u2', 'x-user-roles': 'admin, clinic_manager' },
    };
    expect(() => guard.canActivate(contextWith(request))).toThrow(UnauthorizedException);
  });

  it('rejects a request with no identity', () => {
    expect(() => guard.canActivate(contextWith({ headers: {} }))).toThrow(UnauthorizedException);
  });

  it('rejects a user without any portal-relevant role', () => {
    expect(() =>
      guard.canActivate(contextWith({ user: { id: 'u3', roles: ['pharmacist'] } })),
    ).toThrow(ForbiddenException);
  });
});
