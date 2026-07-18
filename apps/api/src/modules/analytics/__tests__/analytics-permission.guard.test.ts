import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AnalyticsPermissionGuard } from '../api/analytics-permission.guard';
import { AnalyticsPolicy } from '../policies/analytics-policy.service';

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

describe('AnalyticsPermissionGuard', () => {
  let guard: AnalyticsPermissionGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AnalyticsPermissionGuard, AnalyticsPolicy],
    }).compile();

    guard = module.get(AnalyticsPermissionGuard);
  });

  it('throws BadRequestException when tenant header is missing', () => {
    const request = { headers: {}, user: { id: 'user-1', roles: ['analyst'], tenantId: 'tenant-123' } };
    const ctx = new MockExecutionContext(request);

    expect(() => guard.canActivate(ctx)).toThrow(BadRequestException);
  });

  it('throws UnauthorizedException when user context is missing', () => {
    const request = { headers: { 'x-tenant-id': 'tenant-123' }, user: null };
    const ctx = new MockExecutionContext(request);

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws ForbiddenException when tenant mismatch occurs', () => {
    const request = { headers: { 'x-tenant-id': 'tenant-123' }, user: { id: 'user-1', roles: ['analyst'], tenantId: 'tenant-999' } };
    const ctx = new MockExecutionContext(request);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows access when valid tenant and roles are present', () => {
    const request: any = { headers: { 'x-tenant-id': 'tenant-123' }, user: { id: 'user-1', roles: ['analyst'], tenantId: 'tenant-123' } };
    const ctx = new MockExecutionContext(request);

    expect(guard.canActivate(ctx)).toBe(true);
    expect(request.analyticsContext).toEqual({
      tenantId: 'tenant-123',
      userId: 'user-1',
      userRoles: ['analyst'],
      userTenantId: 'tenant-123',
      userBranchId: undefined,
    });
  });
});
