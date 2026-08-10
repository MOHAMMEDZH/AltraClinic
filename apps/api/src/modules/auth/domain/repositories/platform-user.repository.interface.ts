import { PlatformUser } from '../entities/platform-user.entity';

export interface PlatformUserRepository {
  findByEmail(email: string): Promise<PlatformUser | null>;
  findById(id: string): Promise<PlatformUser | null>;
  save(user: PlatformUser): Promise<void>;
  updateLoginState(user: PlatformUser): Promise<void>;
  /** Persists MFA enrollment/challenge state (enabled flag, secret envelopes, pending, replay step). */
  updateMfaState(user: PlatformUser): Promise<void>;
  list(input: { page: number; pageSize: number; search?: string; status?: string; roleKey?: string }): Promise<{ items: PlatformUser[]; total: number }>;
  updateLifecycle(id: string, data: { status: string; isActive?: boolean; suspendedAt?: Date | null; suspendedReason?: string | null; suspendedById?: string | null }): Promise<void>;
  updateAuthzRevision(id: string): Promise<number>;
  countByRoleKey(roleKey: string, active?: boolean): Promise<number>;
  countActiveUsers(): Promise<number>;
}
