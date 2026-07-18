import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { NotificationPermissionGuard } from '../api/notification-permission.guard';
import { NotificationPolicyService } from '../policies/notification-policy.service';
import { NOTIFICATION_REPOSITORY } from '../../../infrastructure/provider.tokens';

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

describe('NotificationPermissionGuard', () => {
  let guard: NotificationPermissionGuard;
  let repo: { findById: jest.Mock };

  beforeEach(async () => {
    repo = { findById: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationPermissionGuard,
        NotificationPolicyService,
        { provide: NOTIFICATION_REPOSITORY, useValue: repo },
      ],
    }).compile();

    guard = module.get(NotificationPermissionGuard);
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

  it('denies access when tenant mismatches', async () => {
    const user = { id: 'user-1', roles: ['patient'], tenantId: 'tenant-2' };
    const ctx = new MockExecutionContext({ user, headers: { 'x-tenant-id': 'tenant-1' } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('allows tenant_admin access when tenant matches', async () => {
    const user = { id: 'user-1', roles: ['tenant_admin'], tenantId: 'tenant-1' };
    const ctx = new MockExecutionContext({ user, headers: { 'x-tenant-id': 'tenant-1' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('allows patient to list their own notifications by setting recipientId query', async () => {
    const user = { id: 'patient-1', roles: ['patient'], tenantId: 'tenant-1' };
    const request: any = { user, headers: { 'x-tenant-id': 'tenant-1' }, method: 'GET', query: {} };
    const ctx = new MockExecutionContext(request);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.query.recipientId).toBe('patient-1');
  });

  it('denies patient if requesting another recipient', async () => {
    const user = { id: 'patient-1', roles: ['patient'], tenantId: 'tenant-1' };
    const request = { user, headers: { 'x-tenant-id': 'tenant-1' }, method: 'GET', query: { recipientId: 'other-user' } };
    const ctx = new MockExecutionContext(request);

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('allows patient to mark their own notification as read', async () => {
    const user = { id: 'patient-1', roles: ['patient'], tenantId: 'tenant-1' };
    const request = {
      user,
      headers: { 'x-tenant-id': 'tenant-1' },
      method: 'POST',
      params: { notificationId: 'notif-1' },
    };
    repo.findById.mockResolvedValue({ recipientId: 'patient-1' });
    const ctx = new MockExecutionContext(request);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(repo.findById).toHaveBeenCalledWith('notif-1', 'tenant-1');
  });

  it('denies patient from reading another patient notification', async () => {
    const user = { id: 'patient-1', roles: ['patient'], tenantId: 'tenant-1' };
    const request = {
      user,
      headers: { 'x-tenant-id': 'tenant-1' },
      method: 'POST',
      params: { notificationId: 'notif-1' },
    };
    repo.findById.mockResolvedValue({ recipientId: 'other-user' });
    const ctx = new MockExecutionContext(request);

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
