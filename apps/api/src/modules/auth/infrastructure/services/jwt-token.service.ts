import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'crypto';
import {
  AuthSessionClass,
  JwtClaimsVO,
  PLATFORM_PREAUTH_TOKEN_AUDIENCE,
  PLATFORM_TOKEN_AUDIENCE,
  RefreshTokenClaimsVO,
} from '../../domain/value-objects/jwt-claims.vo';
import { TokenPairVO } from '../../domain/value-objects/token-pair.vo';
import { UserRole } from '../../../identity/domain/user.entity';
import type { MfaChallengeClaims } from '../../domain/value-objects/mfa-challenge-claims.vo';

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
  mfaChallengeExpiresIn: number;
  /** Dedicated platform signing secrets when configured. */
  platformAccessSecret: string;
  platformRefreshSecret: string;
  platformIssuer: string;
  platformAccessExpiresIn: number;
  platformRefreshExpiresIn: number;
  /** True when platform secrets equal clinic secrets (non-production fallback). */
  platformSecretsSharedWithClinic: boolean;
}

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: JwtConfig,
  ) {}

  /**
   * Issue an access + refresh token pair for an authenticated user session.
   * sessionClass defaults to staff for backward compatibility (OD-SESSION / Phase 46b).
   */
  issueTokenPair(input: {
    userId: string;
    tenantId: string;
    branchId: string | null;
    roles: UserRole[];
    sessionId: string;
    sessionClass?: AuthSessionClass;
  }): TokenPairVO {
    const sessionClass = input.sessionClass ?? 'staff';
    if (sessionClass === 'platform') {
      throw new Error('Use issuePlatformTokenPair for platform principals.');
    }
    const rawRefresh = randomBytes(64).toString('hex');

    const accessClaims = new JwtClaimsVO({
      sub: input.userId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      roles: input.roles,
      sessionId: input.sessionId,
      sessionClass,
    });

    const refreshClaims = new RefreshTokenClaimsVO({
      sub: input.userId,
      sessionId: input.sessionId,
      sessionClass,
    });

    const accessToken = this.jwtService.sign(accessClaims.toPlain(), {
      secret: this.config.accessSecret,
      expiresIn: this.config.accessExpiresIn,
    });

    const refreshToken = this.jwtService.sign(
      {
        sub: refreshClaims.sub,
        sessionId: refreshClaims.sessionId,
        type: refreshClaims.type,
        sessionClass: refreshClaims.sessionClass,
        principalType: refreshClaims.principalType,
        aud: refreshClaims.aud,
        token: rawRefresh,
      },
      {
        secret: this.config.refreshSecret,
        expiresIn: this.config.refreshExpiresIn,
      },
    );

    return new TokenPairVO({
      accessToken,
      refreshToken,
      accessExpiresIn: this.config.accessExpiresIn,
      sessionId: input.sessionId,
    });
  }

  /** Platform control-plane token pair — no tenantId, aud=platform, distinct issuer. */
  issuePlatformTokenPair(input: {
    platformUserId: string;
    sessionId: string;
  }): TokenPairVO {
    const rawRefresh = randomBytes(64).toString('hex');
    const accessClaims = new JwtClaimsVO({
      sub: input.platformUserId,
      tenantId: null,
      branchId: null,
      roles: [],
      sessionId: input.sessionId,
      sessionClass: 'platform',
      principalType: 'platform',
      aud: PLATFORM_TOKEN_AUDIENCE,
      iss: this.config.platformIssuer,
    });

    const accessToken = this.jwtService.sign(accessClaims.toPlain(), {
      secret: this.config.platformAccessSecret,
      expiresIn: this.config.platformAccessExpiresIn,
    });

    const refreshToken = this.jwtService.sign(
      {
        sub: input.platformUserId,
        sessionId: input.sessionId,
        type: 'refresh',
        sessionClass: 'platform',
        principalType: 'platform',
        aud: PLATFORM_TOKEN_AUDIENCE,
        iss: this.config.platformIssuer,
        token: rawRefresh,
      },
      {
        secret: this.config.platformRefreshSecret,
        expiresIn: this.config.platformRefreshExpiresIn,
      },
    );

    return new TokenPairVO({
      accessToken,
      refreshToken,
      accessExpiresIn: this.config.platformAccessExpiresIn,
      sessionId: input.sessionId,
    });
  }

  /**
   * Short-lived platform pre-session token issued after password verification but
   * before MFA completes. Type is 'platform_preauth' (never 'access'), so
   * JwtStrategy — which only accepts type==='access' — always rejects it on
   * every protected route including /platform/auth/me.
   */
  issuePlatformPreauthToken(input: {
    platformUserId: string;
    purpose: 'mfa_challenge' | 'mfa_enrollment';
    transactionId: string;
    expiresInSeconds: number;
  }): { token: string; expiresIn: number } {
    const payload = {
      type: 'platform_preauth' as const,
      sub: input.platformUserId,
      purpose: input.purpose,
      transactionId: input.transactionId,
      sessionClass: 'platform' as const,
      principalType: 'platform' as const,
      aud: PLATFORM_PREAUTH_TOKEN_AUDIENCE,
      iss: this.config.platformIssuer,
    };

    const token = this.jwtService.sign(payload, {
      secret: this.config.platformAccessSecret,
      expiresIn: input.expiresInSeconds,
    });

    return { token, expiresIn: input.expiresInSeconds };
  }

  verifyPlatformPreauthToken(
    token: string,
    expectedPurpose: 'mfa_challenge' | 'mfa_enrollment',
  ): { platformUserId: string; purpose: string; transactionId: string } | null {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.config.platformAccessSecret,
      }) as Record<string, unknown>;
      if (payload['type'] !== 'platform_preauth') return null;
      if (payload['aud'] !== PLATFORM_PREAUTH_TOKEN_AUDIENCE) return null;
      if (payload['iss'] !== this.config.platformIssuer) return null;
      if (payload['sessionClass'] !== 'platform') return null;
      if (payload['principalType'] !== 'platform') return null;
      if (payload['purpose'] !== expectedPurpose) return null;
      return {
        platformUserId: payload['sub'] as string,
        purpose: payload['purpose'] as string,
        transactionId: payload['transactionId'] as string,
      };
    } catch {
      return null;
    }
  }

  verifyAccessToken(token: string): JwtClaimsVO | null {
    const payload = this.verifyAccessPayload(token);
    if (!payload || payload['type'] !== 'access') return null;
    return this.claimsFromPayload(payload);
  }

  /** Verify access JWT with clinic or platform secret based on claims. */
  verifyAccessPayload(token: string): Record<string, unknown> | null {
    try {
      return this.jwtService.verify(token, {
        secret: this.config.accessSecret,
      }) as Record<string, unknown>;
    } catch {
      try {
        return this.jwtService.verify(token, {
          secret: this.config.platformAccessSecret,
        }) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
  }

  claimsFromPayload(payload: Record<string, unknown>): JwtClaimsVO | null {
    if (payload['type'] !== 'access') return null;
    const sessionClass = (payload['sessionClass'] as AuthSessionClass | undefined) ?? 'staff';
    const tenantRaw = payload['tenantId'];
    const tenantId =
      tenantRaw === undefined || tenantRaw === null || tenantRaw === ''
        ? null
        : String(tenantRaw);

    if (sessionClass === 'platform') {
      if (payload['aud'] !== PLATFORM_TOKEN_AUDIENCE) return null;
      if (payload['principalType'] !== 'platform') return null;
      if (payload['iss'] !== this.config.platformIssuer) return null;
      if (tenantId != null) return null;
    }

    return new JwtClaimsVO({
      sub: payload['sub'] as string,
      tenantId: sessionClass === 'platform' ? null : (tenantId as string),
      branchId: (payload['branchId'] as string | null) ?? null,
      roles: (payload['roles'] as UserRole[]) ?? [],
      sessionId: payload['sessionId'] as string,
      jti: payload['jti'] as string | undefined,
      sessionClass,
      principalType: payload['principalType'] as JwtClaimsVO['principalType'] | undefined,
      aud: payload['aud'] as string | undefined,
      iss: (payload['iss'] as string | null | undefined) ?? null,
    });
  }

  verifyRefreshToken(token: string): RefreshTokenClaimsVO | null {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.config.refreshSecret,
      }) as Record<string, unknown>;
      if (payload['type'] !== 'refresh') return null;
      if (payload['sessionClass'] === 'platform' || payload['aud'] === PLATFORM_TOKEN_AUDIENCE) {
        return null;
      }
      return new RefreshTokenClaimsVO({
        sub: payload['sub'] as string,
        sessionId: payload['sessionId'] as string,
        sessionClass: (payload['sessionClass'] as AuthSessionClass | undefined) ?? 'staff',
      });
    } catch {
      return null;
    }
  }

  verifyPlatformRefreshToken(token: string): RefreshTokenClaimsVO | null {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.config.platformRefreshSecret,
      }) as Record<string, unknown>;
      if (payload['type'] !== 'refresh') return null;
      if (payload['sessionClass'] !== 'platform') return null;
      if (payload['principalType'] !== 'platform') return null;
      if (payload['aud'] !== PLATFORM_TOKEN_AUDIENCE) return null;
      if (payload['iss'] !== this.config.platformIssuer) return null;
      return new RefreshTokenClaimsVO({
        sub: payload['sub'] as string,
        sessionId: payload['sessionId'] as string,
        sessionClass: 'platform',
        principalType: 'platform',
        aud: PLATFORM_TOKEN_AUDIENCE,
        iss: this.config.platformIssuer,
      });
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

  getPlatformRefreshExpiresAt(): Date {
    return new Date(Date.now() + this.config.platformRefreshExpiresIn * 1000);
  }

  getPlatformAccessExpiresIn(): number {
    return this.config.platformAccessExpiresIn;
  }

  getPlatformIssuer(): string {
    return this.config.platformIssuer;
  }

  issueMfaChallenge(input: {
    userId: string;
    tenantId: string;
    sessionId: string;
    ipAddress: string;
    userAgent: string;
    deviceName: string | null;
    sessionClass?: AuthSessionClass;
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
      sessionClass: input.sessionClass ?? 'staff',
    };

    const token = this.jwtService.sign(payload as unknown as object, {
      secret: this.config.accessSecret,
      expiresIn,
    });

    return { token, expiresIn };
  }

  verifyMfaChallenge(token: string): MfaChallengeClaims | null {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.config.accessSecret,
      }) as Record<string, unknown>;
      if (payload['type'] !== 'mfa_challenge') return null;
      return {
        type: 'mfa_challenge',
        sub: payload['sub'] as string,
        tenantId: payload['tenantId'] as string,
        sessionId: payload['sessionId'] as string,
        ipAddress: payload['ipAddress'] as string,
        userAgent: payload['userAgent'] as string,
        deviceName: (payload['deviceName'] as string | null) ?? null,
        sessionClass: (payload['sessionClass'] as AuthSessionClass | undefined) ?? 'staff',
      };
    } catch {
      return null;
    }
  }
}
