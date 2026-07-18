import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuditPermissionGuard } from '../api/audit-permission.guard';
import { AuditPolicy } from '../policies/audit-policy.service';

describe('AuditPermissionGuard', () => {
  const guard = new AuditPermissionGuard(new AuditPolicy());

  function contextWith(request: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  it('allows audit-capable roles from request.user', () => {
    const request: Record<string, unknown> = { user: { id: 'auditor-1', roles: ['auditor'] } };
    expect(guard.canActivate(contextWith(request))).toBe(true);
    expect((request.user as { roles: string[] }).roles).toEqual(['auditor']);
  });

  it('rejects header-only identity', () => {
    const request: Record<string, unknown> = {
      headers: { 'x-user-id': 'u1', 'x-user-roles': 'auditor' },
    };
    expect(() => guard.canActivate(contextWith(request))).toThrow(UnauthorizedException);
  });

  it('rejects missing principal', () => {
    expect(() => guard.canActivate(contextWith({ headers: {} }))).toThrow(UnauthorizedException);
  });

  it('rejects unauthorized roles', () => {
    const request: Record<string, unknown> = { user: { id: 'reception-1', roles: ['receptionist'] } };
    expect(() => guard.canActivate(contextWith(request))).toThrow(ForbiddenException);
  });
});
