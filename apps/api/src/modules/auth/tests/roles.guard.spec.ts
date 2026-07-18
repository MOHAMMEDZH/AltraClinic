import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../api/guards/roles.guard';
import { JwtClaimsVO } from '../domain/value-objects/jwt-claims.vo';

function makeContext(roles: string[], requiredRoles?: string[]): ExecutionContext {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(requiredRoles) } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  const user = new JwtClaimsVO({
    sub: 'u1', tenantId: 't1', branchId: null,
    roles: roles as any, sessionId: 's1',
  });

  const ctx = {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;

  return ctx;
}

describe('RolesGuard', () => {
  it('allows when no roles required', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const ctx = makeContext(['patient']);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows super_admin for any role requirement', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['doctor']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const user = new JwtClaimsVO({ sub: 'u1', tenantId: 't1', branchId: null, roles: ['super_admin'] as any, sessionId: 's1' });
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows user with matching role', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['doctor']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const ctx = makeContext(['doctor']);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies user without required role', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['accountant']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const ctx = makeContext(['patient']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('owner inherits doctor role access', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['doctor']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const ctx = makeContext(['owner']);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
