import { Dashboard } from '../entities/dashboard.entity';

/**
 * Dashboard Repository Interface
 * Abstraction for dashboard persistence
 */
export interface DashboardRepository {
  save(dashboard: Dashboard): Promise<void>;
  findById(dashboardId: string, tenantId: string): Promise<Dashboard | null>;
  listByTenant(tenantId: string, branchId?: string, limit?: number, offset?: number): Promise<Dashboard[]>;
  listByType(tenantId: string, dashboardType: string, branchId?: string, limit?: number, offset?: number): Promise<Dashboard[]>;
  findDefault(tenantId: string, dashboardType: string): Promise<Dashboard | null>;
  delete(dashboardId: string, tenantId: string): Promise<void>;
  count(tenantId: string, branchId?: string): Promise<number>;
}
