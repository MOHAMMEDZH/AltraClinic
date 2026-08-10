import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { JwtClaimsVO, PLATFORM_TOKEN_AUDIENCE } from '../../domain/value-objects/jwt-claims.vo';
import { SessionCacheService } from '../../../../infrastructure/redis/services/session-cache.service';
import type { JwtConfig } from '../services/jwt-token.service';
import { JwtTokenService } from '../services/jwt-token.service';
import { PrismaService } from '../../../../infrastructure/prisma.service';

/**
 * Access-token JWT Passport strategy.
 * Supports clinic/patient secrets and dedicated platform secrets (audience-selected).
 * Flexible Step 19 — Clinic principals re-read PlatformTenant.status on every request
 * so an already-issued access token cannot outlive suspension/archive.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly jwtConfig: JwtConfig,
    private readonly sessionCache: SessionCacheService,
    private readonly jwtTokenService: JwtTokenService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      passReqToCallback: false,
      secretOrKeyProvider: (
        _request: Request,
        rawJwtToken: string,
        done: (err: Error | null, secret?: string) => void,
      ) => {
        try {
          const decoded = this.jwtService.decode(rawJwtToken) as Record<string, unknown> | null;
          if (
            decoded &&
            (decoded['aud'] === PLATFORM_TOKEN_AUDIENCE || decoded['sessionClass'] === 'platform')
          ) {
            done(null, this.jwtConfig.platformAccessSecret);
            return;
          }
          done(null, this.jwtConfig.accessSecret);
        } catch (err) {
          done(err as Error);
        }
      },
    });
  }

  async validate(payload: Record<string, unknown>): Promise<JwtClaimsVO> {
    if (payload['type'] !== 'access') {
      throw new UnauthorizedException('Invalid token type.');
    }

    const claims = this.jwtTokenService.claimsFromPayload(payload);
    if (!claims) {
      throw new UnauthorizedException('Invalid token claims.');
    }

    if (claims.isPlatformSession()) {
      if (claims.aud !== PLATFORM_TOKEN_AUDIENCE) {
        throw new UnauthorizedException('Invalid platform token audience.');
      }
      if (claims.iss !== this.jwtConfig.platformIssuer) {
        throw new UnauthorizedException('Invalid platform token issuer.');
      }
      if (claims.tenantId != null) {
        throw new UnauthorizedException('Platform tokens must not carry tenant context.');
      }
    } else if (claims.aud === PLATFORM_TOKEN_AUDIENCE || claims.sessionClass === 'platform') {
      throw new UnauthorizedException('Invalid token principal boundary.');
    }

    const jti = claims.jti;

    if (jti && (await this.sessionCache.isJtiBlacklisted(jti))) {
      throw new UnauthorizedException('Token has been revoked.');
    }

    // Clinic/staff/patient access — fail closed on PlatformTenant lifecycle
    if (!claims.isPlatformSession() && claims.tenantId) {
      const platformTenant = await this.prisma.platformTenant.findUnique({
        where: { tenantId: claims.tenantId },
        select: { status: true },
      });
      if (
        platformTenant &&
        (platformTenant.status === 'PROVISIONING' ||
          platformTenant.status === 'SUSPENDED' ||
          platformTenant.status === 'ARCHIVED')
      ) {
        throw new UnauthorizedException({
          code: 'tenant_lifecycle_denied',
          message: 'Tenant is not accessible.',
        });
      }
    }

    return claims;
  }
}
