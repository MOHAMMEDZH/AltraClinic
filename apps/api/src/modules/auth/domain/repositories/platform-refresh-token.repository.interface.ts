import { PlatformRefreshToken } from '../entities/platform-refresh-token.entity';

export interface PlatformRefreshTokenRepository {
  save(token: PlatformRefreshToken): Promise<void>;
  findByTokenHash(hash: string): Promise<PlatformRefreshToken | null>;
  findById(id: string): Promise<PlatformRefreshToken | null>;
  findBySessionId(sessionId: string): Promise<PlatformRefreshToken | null>;
  /** Active (non-revoked, non-expired) sessions for a user — used for the sessions list. */
  findActiveByUserId(platformUserId: string): Promise<PlatformRefreshToken[]>;
  revokeBySessionId(sessionId: string, reason?: string): Promise<void>;
  /** Ownership-scoped revoke; returns 0 when session is missing or belongs to another user. */
  revokeBySessionIdForUser(platformUserId: string, sessionId: string, reason?: string): Promise<number>;
  /** Returns the number of sessions revoked. */
  revokeAllByUserId(platformUserId: string, reason?: string): Promise<number>;
  /** Returns the number of sessions revoked (excludes exceptSessionId). */
  revokeOthersByUserId(
    platformUserId: string,
    exceptSessionId: string,
    reason?: string,
  ): Promise<number>;
  revokeFamily(familyId: string): Promise<void>;
  touchActivity(sessionId: string, at: Date): Promise<void>;
  markStepUpVerified(sessionId: string, at: Date): Promise<void>;
}
