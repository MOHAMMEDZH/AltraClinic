import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtClaimsVO } from '../domain/value-objects/jwt-claims.vo';
import { PlatformUserRepository } from '../domain/repositories/platform-user.repository.interface';
import { PLATFORM_USER_REPOSITORY } from '../platform-auth.tokens';
import {
  isKnownActivePermission,
  permissionsForRoles,
  PLATFORM_ROLE_KEY_SET,
} from './platform-rbac.catalog';
import { PrismaService } from '../../../infrastructure/prisma.service';

@Injectable()
export class PlatformAuthorizationService {
  private readonly cache = new Map<string, { roleKeys: string[]; permissions: string[] }>();

  constructor(
    @Inject(PLATFORM_USER_REPOSITORY) private readonly users: PlatformUserRepository,
    private readonly prisma: PrismaService,
  ) {}

  async resolveActiveRoleKeys(userId: string): Promise<string[]> {
    const assignments = await this.prisma.platformUserRole.findMany({
      where: { platformUserId: userId, revokedAt: null }, select: { roleKey: true },
    });
    return assignments.map((x) => x.roleKey).filter((key) => PLATFORM_ROLE_KEY_SET.has(key)).sort();
  }

  async resolveEffectivePermissions(userId: string): Promise<string[]> {
    const user = await this.users.findById(userId);
    if (!user || !user.canAuthenticate()) return [];
    const cacheKey = `${userId}:${user.authzRevision}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached.permissions;
    const roleKeys = await this.resolveActiveRoleKeys(userId);
    const permissions = permissionsForRoles(roleKeys).filter(isKnownActivePermission);
    this.cache.set(cacheKey, { roleKeys, permissions });
    return permissions;
  }

  async assertPermission(claims: JwtClaimsVO, permissionKey: string): Promise<void> {
    if (!claims.isPlatformSession()) throw new UnauthorizedException('Platform authentication required.');
    if (!isKnownActivePermission(permissionKey)) throw new ForbiddenException('Unknown platform permission.');
    const user = await this.users.findById(claims.sub);
    if (!user || !user.canAuthenticate()) throw new ForbiddenException('Platform account is inactive.');
    const permissions = await this.resolveEffectivePermissions(user.id);
    if (!permissions.includes(permissionKey)) throw new ForbiddenException('Platform permission denied.');
  }

  /** Clears in-memory authz cache for a user (non-durable). */
  invalidateAuthzCache(userId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${userId}:`)) this.cache.delete(key);
    }
  }

  async bumpAuthzRevision(userId: string): Promise<number> {
    this.invalidateAuthzCache(userId);
    return this.users.updateAuthzRevision(userId);
  }

  countActiveOwners(): Promise<number> { return this.users.countByRoleKey('platform_owner', true); }
  countActiveSecurityAdmins(): Promise<number> { return this.users.countByRoleKey('security_administrator', true); }
}
