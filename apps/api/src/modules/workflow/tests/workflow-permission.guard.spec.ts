import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { WorkflowPermissionGuard } from '../api/workflow-permission.guard';
import { WorkflowPolicy } from '../policies/workflow-policy.service';

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

describe('WorkflowPermissionGuard', () => {
  let guard: WorkflowPermissionGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkflowPermissionGuard, WorkflowPolicy],
    }).compile();

    guard = module.get<WorkflowPermissionGuard>(WorkflowPermissionGuard);
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

  it('allows owner role with workflow access', () => {
    const user = { id: 'user-1', roles: ['owner'], tenantId: 'tenant-1' };
    const ctx = new MockExecutionContext({ user, headers: { 'x-tenant-id': 'tenant-1' } });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
