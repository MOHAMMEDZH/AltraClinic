import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'crypto';
import { JwtClaimsVO, RefreshTokenClaimsVO } from '../../domain/value-objects/jwt-claims.vo';
import { TokenPairVO } from '../../domain/value-objects/token-pair.vo';
import { UserRole } from '../../../identity/domain/user.entity';
import type { MfaChallengeClaims } from '../../domain/value-objects/mfa-challenge-claims.vo';

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessExpiresIn: number;   // seconds
  refreshExpiresIn: number;  // seconds
  mfaChallengeExpiresIn: number;
}

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: JwtConfig,
  ) {}

  /**
   * Issue an access + refresh token pair for an authenticated user session.
   * COMPETING ARCHITECT:
   *   Challenger: "Embed permissions in JWT to avoid per-request DB lookups."
   *   Decision: Roles only — not permission bits. Reasons:
   *     (1) Permissions can change mid-session; roles are coarser-grained.
   *     (2) JWT size grows O(resources × actions) if permissions included.
   *     (3) Permission evaluation against the matrix is a fast in-memory operation.
   *   If permission evaluation latency becomes a concern, a Redis permission cache
   *   keyed on userId+tenantId is the correct optimization.
   */
  issueTokenPair(input: {
    userId: string;
    tenantId: string;
    branchId: string | null;
    roles: UserRole[];
    sessionId: string;
  }): TokenPairVO {
    const rawRefresh = randomBytes(64).toString('hex');

    const accessClaims = new JwtClaimsVO({
      sub: input.userId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      roles: input.roles,
      sessionId: input.sessionId,
    });

    const refreshClaims: RefreshTokenClaimsVO = {
      sub: input.userId,
      sessionId: input.sessionId,
      type: 'refresh',
    };

    const accessToken = this.jwtService.sign(accessClaims.toPlain(), {
      secret: this.config.accessSecret,
      expiresIn: this.config.accessExpiresIn,
    });

    // Refresh token is a signed JWT so we can verify integrity before hitting DB
    const refreshToken = this.jwtService.sign(refreshClaims as unknown as object, {
      secret: this.config.refreshSecret,
      expiresIn: this.config.refreshExpiresIn,
    });

    return new TokenPairVO({
      accessToken,
      refreshToken,
      accessExpiresIn: this.config.accessExpiresIn,
      sessionId: input.sessionId,
    });
  }

  verifyAccessToken(token: string): JwtClaimsVO | null {
    try {
      const payload = this.jwtService.verify(token, { secret: this.config.accessSecret }) as Record<string, unknown>;
      if (payload['type'] !== 'access') return null;
      return new JwtClaimsVO({
        sub: payload['sub'] as string,
        tenantId: payload['tenantId'] as string,
        branchId: (payload['branchId'] as string | null) ?? null,
        roles: (payload['roles'] as UserRole[]) ?? [],
        sessionId: payload['sessionId'] as string,
        jti: payload['jti'] as string | undefined,
      });
    } catch {
      return null;
    }
  }

  verifyRefreshToken(token: string): RefreshTokenClaimsVO | null {
    try {
      const payload = this.jwtService.verify(token, { secret: this.config.refreshSecret }) as Record<string, unknown>;
      if (payload['type'] !== 'refresh') return null;
      return { sub: payload['sub'] as string, sessionId: payload['sessionId'] as string, type: 'refresh' };
    } catch {
      return null;
    }
  }

  generateSessionId(): string {
    return randomUUID();
  }

  getRefreshExpiresAt(): Date {
    return new Date(Date.now() + this.config.refreshExpiresIn * 1000);
  }

  issueMfaChallenge(input: {
    userId: string;
    tenantId: string;
    sessionId: string;
    ipAddress: string;
    userAgent: string;
    deviceName: string | null;
  }): { token: string; expiresIn: number } {
    const expiresIn = this.config.mfaChallengeExpiresIn;
    const payload: MfaChallengeClaims = {
      type: 'mfa_challenge',
      sub: input.userId,
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      deviceName: input.deviceName,
    };

    const token = this.jwtService.sign(payload as unknown as object, {
      secret: this.config.accessSecret,
      expiresIn,
    });

    return { token, expiresIn };
  }

  verifyMfaChallenge(token: string): MfaChallengeClaims | null {
    try {
      const payload = this.jwtService.verify(token, { secret: this.config.accessSecret }) as Record<
        string,
        unknown
      >;
      if (payload['type'] !== 'mfa_challenge') return null;
      return {
        type: 'mfa_challenge',
        sub: payload['sub'] as string,
        tenantId: payload['tenantId'] as string,
        sessionId: payload['sessionId'] as string,
        ipAddress: payload['ipAddress'] as string,
        userAgent: payload['userAgent'] as string,
        deviceName: (payload['deviceName'] as string | null) ?? null,
      };
    } catch {
      return null;
    }
  }
}
