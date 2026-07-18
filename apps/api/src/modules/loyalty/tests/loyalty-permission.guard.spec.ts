import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { LoyaltyPermissionGuard } from '../api/loyalty-permission.guard';
import { LoyaltyPolicyService } from '../policies/loyalty-policy.service';

class MockExecutionContext implements ExecutionContext {
  constructor(private readonly request: any) {}
  getClass(): any { return null; }
  getHandler(): any { return null; }
  switchToHttp(): any {
    return {
      getRequest: () => this.request,
      getResponse: () => undefined,
      getNext: () => undefined,
    };
  }
  switchToRpc() { return null as any; }
  switchToWs() { return null as any; }
  getArgByIndex<T = any>(index: number): T { return undefined as any; }
  getArgs<T extends any[] = any[]>(): T { return [] as unknown as T; }
  getType<TContext extends string = string>(): TContext { return 'http' as TContext; }
}

describe('LoyaltyPermissionGuard', () => {
  let guard: LoyaltyPermissionGuard;
  let policy: LoyaltyPolicyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoyaltyPermissionGuard, LoyaltyPolicyService],
    }).compile();

    guard = module.get(LoyaltyPermissionGuard);
    policy = module.get(LoyaltyPolicyService);
  });

  it('throws UnauthorizedException when user is missing', async () => {
    const ctx = new MockExecutionContext({ headers: { 'x-tenant-id': 'tenant-1' } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws ForbiddenException when tenant header is missing', async () => {
    const user = { id: 'user-1', roles: ['patient'], tenantId: 'tenant-1' };
    const ctx = new MockExecutionContext({ user, headers: {} });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('allows access when user role and tenant match', async () => {
    const user = { id: 'user-1', roles: ['tenant_admin'], tenantId: 'tenant-1' };
    const ctx = new MockExecutionContext({ user, headers: { 'x-tenant-id': 'tenant-1' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('denies access when user tenant mismatches', async () => {
    const user = { id: 'user-1', roles: ['patient'], tenantId: 'tenant-2' };
    const ctx = new MockExecutionContext({ user, headers: { 'x-tenant-id': 'tenant-1' } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
