import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PlatformAdminPermissionGuard } from '../api/platform-admin-permission.guard';
import { PlatformAdminPolicy } from '../policies/platform-admin-policy.service';

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('PlatformAdminPermissionGuard', () => {
  const guard = new PlatformAdminPermissionGuard(new PlatformAdminPolicy());

  it('allows a system administrator', () => {
    const request = { user: { id: 'admin-1', roles: ['system_administrator'] }, headers: {} };
    expect(guard.canActivate(makeContext(request))).toBe(true);
    expect(request.user?.roles).toContain('system_administrator');
  });

  it('rejects missing credentials', () => {
    expect(() => guard.canActivate(makeContext({ headers: {} }))).toThrow(UnauthorizedException);
  });

  it('rejects non-super-admin roles', () => {
    expect(() =>
      guard.canActivate(makeContext({ user: { id: 'mgr-1', roles: ['tenant_admin'] }, headers: {} })),
    ).toThrow(ForbiddenException);
  });
});
