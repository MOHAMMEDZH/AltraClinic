import { Injectable } from '@nestjs/common';
import { Dashboard } from '../domain/entities/dashboard.entity';
import { DashboardRepository } from '../domain/repositories/dashboard.repository.interface';

/**
 * In-Memory Dashboard Repository
 * Development implementation using Map-based storage with tenant isolation
 */
@Injectable()
export class InMemoryDashboardRepository implements DashboardRepository {
  private readonly store = new Map<string, Map<string, Dashboard>>();

  private bucket(tenantId: string): Map<string, Dashboard> {
    const key = tenantId.trim().toLowerCase();
    if (!this.store.has(key)) {
      this.store.set(key, new Map());
    }
    return this.store.get(key)!;
  }

  async save(dashboard: Dashboard): Promise<void> {
    const bucket = this.bucket(dashboard.tenantId);
    bucket.set(dashboard.dashboardId, dashboard);
  }

  async findById(dashboardId: string, tenantId: string): Promise<Dashboard | null> {
    return this.bucket(tenantId).get(dashboardId) ?? null;
  }

  async listByTenant(tenantId: string, branchId?: string, limit: number = 20, offset: number = 0): Promise<Dashboard[]> {
    let dashboards = Array.from(this.bucket(tenantId).values());

    if (branchId) {
      dashboards = dashboards.filter((d) => d.branchId === branchId);
    }

    // Sort by created at descending
    dashboards.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return dashboards.slice(offset, offset + limit);
  }

  async listByType(
    tenantId: string,
    dashboardType: string,
    branchId?: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<Dashboard[]> {
    let dashboards = Array.from(this.bucket(tenantId).values()).filter((d) => d.dashboardType === dashboardType);

    if (branchId) {
      dashboards = dashboards.filter((d) => d.branchId === branchId);
    }

    // Sort by created at descending
    dashboards.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return dashboards.slice(offset, offset + limit);
  }

  async findDefault(tenantId: string, dashboardType: string): Promise<Dashboard | null> {
    const dashboards = Array.from(this.bucket(tenantId).values()).filter(
      (d) => d.dashboardType === dashboardType && d.isDefault,
    );
    return dashboards.length > 0 ? dashboards[0] : null;
  }

  async delete(dashboardId: string, tenantId: string): Promise<void> {
    this.bucket(tenantId).delete(dashboardId);
  }

  async count(tenantId: string, branchId?: string): Promise<number> {
    let dashboards = Array.from(this.bucket(tenantId).values());
    if (branchId) {
      dashboards = dashboards.filter((d) => d.branchId === branchId);
    }
    return dashboards.length;
  }
}
