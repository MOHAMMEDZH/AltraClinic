import { RefreshToken } from '../entities/refresh-token.entity';

export interface RefreshTokenRepository {
  save(token: RefreshToken): Promise<void>;
  findByTokenHash(hash: string): Promise<RefreshToken | null>;
  findBySessionId(sessionId: string): Promise<RefreshToken | null>;
  /** Tenant-scoped active session list — prevents cross-tenant session leakage */
  findActiveByUserId(userId: string, tenantId: string): Promise<RefreshToken[]>;
  revokeBySessionId(sessionId: string): Promise<void>;
  revokeAllByUserId(userId: string): Promise<void>;
  /** Flexible Step 19 — revoke all active clinic sessions for a tenant on suspend/archive. */
  revokeAllByTenantId(tenantId: string): Promise<number>;
  deleteExpired(): Promise<void>;
}
