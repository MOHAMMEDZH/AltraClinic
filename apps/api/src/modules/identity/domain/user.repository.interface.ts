import { User, UserRole, EmploymentStatus } from './user.entity';

export type UserDirectoryStatus = 'active' | 'inactive' | 'locked' | 'all';

export interface UserListQuery {
  tenantId: string;
  search?: string;
  role?: UserRole;
  branchId?: string;
  departmentId?: string;
  regionId?: string;
  employmentStatus?: EmploymentStatus;
  status?: UserDirectoryStatus;
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface UserListResult {
  items: User[];
  total: number;
  page: number;
  limit: number;
  nextCursor?: string | null;
}

export interface UserOverviewStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  lockedUsers: number;
  mfaEnabledUsers: number;
  emailUnverifiedUsers: number;
  newUsers30d: number;
  recentlyActive7d: number;
  onlineSessions: number;
  pendingInvitations: number;
  roleDistribution: Record<string, number>;
  branchDistribution: Record<string, number>;
}

export interface UserRepository {
  findById(id: string, tenantId: string): Promise<User | null>;
  findByEmail(email: string, tenantId: string): Promise<User | null>;
  save(user: User, grantedBy?: string | null): Promise<void>;
  updateLoginState(user: User): Promise<void>;
  list(query: UserListQuery): Promise<UserListResult>;
  getOverviewStats(tenantId: string): Promise<UserOverviewStats>;
  softDelete(userId: string, tenantId: string): Promise<void>;
  countPendingInvitations(tenantId: string): Promise<number>;
}
