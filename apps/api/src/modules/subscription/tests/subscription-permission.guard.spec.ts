import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { SubscriptionPermissionGuard } from '../api/subscription-permission.guard';
import { SubscriptionPolicy } from '../policies/subscription-policy.service';

describe('SubscriptionPermissionGuard', () => {
  const guard = new SubscriptionPermissionGuard(new SubscriptionPolicy());

  function contextWith(request: Record<string, unknown>): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  it('allows authorized roles from request.user', () => {
    const request: Record<string, unknown> = { user: { id: 'finance-1', roles: ['finance'] } };
    expect(guard.canActivate(contextWith(request))).toBe(true);
    expect((request.user as { roles: string[] }).roles).toEqual(['finance']);
  });

  it('rejects header-only identity', () => {
    const request: Record<string, unknown> = {
      headers: { 'x-user-id': 'u1', 'x-user-roles': 'admin' },
    };
    expect(() => guard.canActivate(contextWith(request))).toThrow(UnauthorizedException);
  });

  it('rejects missing user', () => {
    expect(() => guard.canActivate(contextWith({ headers: {} }))).toThrow(UnauthorizedException);
  });

  it('rejects unauthorized roles', () => {
    const request: Record<string, unknown> = { user: { id: 'p1', roles: ['patient'] } };
    expect(() => guard.canActivate(contextWith(request))).toThrow(ForbiddenException);
  });
});
