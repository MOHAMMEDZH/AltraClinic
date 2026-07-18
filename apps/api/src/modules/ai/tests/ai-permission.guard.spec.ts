import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AiPermissionGuard } from '../api/ai-permission.guard';
import { AiPolicy } from '../policies/ai-policy.service';

class MockExecutionContext implements ExecutionContext {
  constructor(private readonly request: any) {}

  getClass(): any {
    return null;
  }

  getHandler(): any {
    return null;
  }

  switchToHttp(): any {
    return {
      getRequest: () => this.request,
      getResponse: () => undefined,
      getNext: () => undefined,
    };
  }

  switchToRpc(): any {
    return null;
  }

  switchToWs(): any {
    return null;
  }

  getArgByIndex<T = any>(index: number): T {
    return undefined as any;
  }

  getArgs<T extends any[] = any[]>(): T {
    return [] as unknown as T;
  }

  getType<TContext extends string = string>(): TContext {
    return 'http' as TContext;
  }
}

describe('AiPermissionGuard', () => {
  let guard: AiPermissionGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiPermissionGuard, AiPolicy],
    }).compile();

    guard = module.get<AiPermissionGuard>(AiPermissionGuard);
  });

  it('throws UnauthorizedException when user is missing', () => {
    const ctx = new MockExecutionContext({ headers: { 'x-tenant-id': 'tenant-1' } });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws ForbiddenException when user has invalid roles', () => {
    const user = { id: 'user-1', roles: ['patient'], tenantId: 'tenant-1' };
    const ctx = new MockExecutionContext({ user, headers: {} });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows ai_admin role', () => {
    const user = { id: 'user-1', roles: ['ai_admin'], tenantId: 'tenant-1' };
    const ctx = new MockExecutionContext({ user, headers: {} });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows ai_manager role', () => {
    const user = { id: 'user-1', roles: ['ai_manager'], tenantId: 'tenant-1' };
    const ctx = new MockExecutionContext({ user, headers: {} });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows tenant_admin role', () => {
    const user = { id: 'user-1', roles: ['tenant_admin'], tenantId: 'tenant-1' };
    const ctx = new MockExecutionContext({ user, headers: {} });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
