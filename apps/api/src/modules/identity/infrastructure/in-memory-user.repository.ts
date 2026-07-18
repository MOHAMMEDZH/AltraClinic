import { Injectable } from '@nestjs/common';
import { User, UserRole } from '../domain/user.entity';
import {
  UserListQuery,
  UserListResult,
  UserOverviewStats,
  UserRepository,
} from '../domain/user.repository.interface';

@Injectable()
export class InMemoryUserRepository implements UserRepository {
  private readonly items: Map<string, User> = new Map();

  async findById(id: string, tenantId: string): Promise<User | null> {
    const user = this.items.get(id);
    if (!user || user.tenantId !== tenantId) return null;
    return user;
  }

  async findByEmail(email: string, tenantId: string): Promise<User | null> {
    const found = Array.from(this.items.values()).find((u) => u.email === email && u.tenantId === tenantId);
    return found ?? null;
  }

  async save(user: User): Promise<void> {
    this.items.set(user.id, user);
  }

  async updateLoginState(user: User): Promise<void> {
    this.items.set(user.id, user);
  }

  async list(query: UserListQuery): Promise<UserListResult> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const now = new Date();

    let items = Array.from(this.items.values()).filter((u) => u.tenantId === query.tenantId);

    if (query.branchId) items = items.filter((u) => u.branchId === query.branchId);
    if (query.role) items = items.filter((u) => u.roles.includes(query.role as UserRole));
    if (query.status === 'active') items = items.filter((u) => u.isActive && !u.isLocked());
    if (query.status === 'inactive') items = items.filter((u) => !u.isActive);
    if (query.status === 'locked') items = items.filter((u) => u.isLocked());
    if (query.search?.trim()) {
      const q = query.search.trim().toLowerCase();
      items = items.filter(
        (u) =>
          u.email.includes(q) ||
          u.fullName.toLowerCase().includes(q) ||
          (u.phone?.includes(q) ?? false),
      );
    }

    items.sort((a, b) => a.fullName.localeCompare(b.fullName));
    const total = items.length;
    const offset = (page - 1) * limit;

    return { items: items.slice(offset, offset + limit), total, page, limit };
  }

  async getOverviewStats(tenantId: string): Promise<UserOverviewStats> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
    const users = Array.from(this.items.values()).filter((u) => u.tenantId === tenantId);

    const roleDistribution: Record<string, number> = {};
    const branchDistribution: Record<string, number> = {};

    for (const user of users) {
      for (const role of user.roles) {
        roleDistribution[role] = (roleDistribution[role] ?? 0) + 1;
      }
      const branchKey = user.branchId ?? 'unassigned';
      branchDistribution[branchKey] = (branchDistribution[branchKey] ?? 0) + 1;
    }

    return {
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.isActive && !u.isLocked()).length,
      inactiveUsers: users.filter((u) => !u.isActive).length,
      lockedUsers: users.filter((u) => u.isLocked()).length,
      mfaEnabledUsers: users.filter((u) => u.mfaEnabled).length,
      emailUnverifiedUsers: users.filter((u) => !u.emailVerified).length,
      newUsers30d: users.filter((u) => u.createdAt >= thirtyDaysAgo).length,
      recentlyActive7d: users.filter((u) => u.lastLoginAt && u.lastLoginAt >= sevenDaysAgo).length,
      onlineSessions: 0,
      pendingInvitations: 0,
      roleDistribution,
      branchDistribution,
    };
  }

  async softDelete(userId: string, tenantId: string): Promise<void> {
    const user = this.items.get(userId);
    if (user && user.tenantId === tenantId) this.items.delete(userId);
  }

  async countPendingInvitations(_tenantId: string): Promise<number> {
    return 0;
  }
}
