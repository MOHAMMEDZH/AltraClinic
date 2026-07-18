import { Module, forwardRef } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

// Domain / Infra
import { PrismaRefreshTokenRepository } from './infrastructure/repositories/prisma-refresh-token.repository';
import { PrismaLoginAttemptRepository } from './infrastructure/repositories/prisma-login-attempt.repository';
import { PrismaPasswordResetTokenRepository } from './infrastructure/repositories/prisma-password-reset-token.repository';
import { PrismaEmailVerificationTokenRepository } from './infrastructure/repositories/prisma-email-verification-token.repository';
import { PrismaMfaBackupCodeRepository } from './infrastructure/repositories/prisma-mfa-backup-code.repository';
import { PrismaTrustedDeviceRepository } from './infrastructure/repositories/prisma-trusted-device.repository';
import { JwtTokenService } from './infrastructure/services/jwt-token.service';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { InMemoryRateLimiter } from './infrastructure/services/in-memory-rate-limiter.service';
import { RedisRateLimiter } from './infrastructure/services/redis-rate-limiter.service';
import { ConsoleEmailSender } from './infrastructure/services/console-email-sender.service';
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { JwtTenantResolver } from './infrastructure/services/jwt-tenant-resolver.service';

// Application handlers
import { LoginHandler } from './application/handlers/login.handler';
import { LogoutHandler } from './application/handlers/logout.handler';
import { LogoutAllHandler } from './application/handlers/logout-all.handler';
import { RefreshTokenHandler } from './application/handlers/refresh-token.handler';
import { ForgotPasswordHandler } from './application/handlers/forgot-password.handler';
import { ResetPasswordHandler } from './application/handlers/reset-password.handler';
import { VerifyEmailHandler } from './application/handlers/verify-email.handler';
import { SendVerificationEmailHandler } from './application/handlers/send-verification-email.handler';
import { ListSessionsHandler } from './application/handlers/list-sessions.handler';
import { ChangePasswordHandler } from './application/handlers/change-password.handler';
import { GetMeHandler } from './application/handlers/get-me.handler';
import { VerifyMfaHandler } from './application/handlers/verify-mfa.handler';
import { SetupMfaHandler } from './application/handlers/setup-mfa.handler';
import { ConfirmMfaHandler } from './application/handlers/confirm-mfa.handler';
import { DisableMfaHandler } from './application/handlers/disable-mfa.handler';
import { RevokeSessionHandler } from './application/handlers/revoke-session.handler';
import { RegenerateMfaBackupCodesHandler } from './application/handlers/regenerate-mfa-backup-codes.handler';
import { LoginCompletionService } from './application/services/login-completion.service';
import { TotpService } from './infrastructure/services/totp.service';
import { MfaBackupCodeService } from './infrastructure/services/mfa-backup-code.service';

// API layer
import { AuthController } from './api/auth.controller';
import { JwtAuthGuard } from './api/guards/jwt-auth.guard';
import { RolesGuard } from './api/guards/roles.guard';
import { PermissionGuard } from './api/guards/permission.guard';

// Tokens
import {
  REFRESH_TOKEN_REPOSITORY,
  LOGIN_ATTEMPT_REPOSITORY,
  PASSWORD_RESET_TOKEN_REPOSITORY,
  EMAIL_VERIFICATION_TOKEN_REPOSITORY,
  MFA_BACKUP_CODE_REPOSITORY,
  TRUSTED_DEVICE_REPOSITORY,
  TENANT_RESOLVER,
} from '../../infrastructure/provider.tokens';
import { EMAIL_SENDER } from './infrastructure/services/email-sender.port';
import { RATE_LIMITER } from './infrastructure/services/rate-limiter.port';

// Shared identity module for UserRepository
import { IdentityModule } from '../identity/identity.module';
import { SettingsModule } from '../settings/settings.module';
import { JwtConfig } from './infrastructure/services/jwt-token.service';
import { SessionCacheService } from '../../infrastructure/redis/services/session-cache.service';

/**
 * JWT config reads from environment variables.
 * Required env vars:
 *   JWT_ACCESS_SECRET    - min 32 chars, random
 *   JWT_REFRESH_SECRET   - min 32 chars, random, different from access secret
 *   JWT_ACCESS_EXPIRES   - seconds, default 900 (15min)
 *   JWT_REFRESH_EXPIRES  - seconds, default 604800 (7 days)
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Use @nestjs/config for env validation."
 *   Decision: Added to roadmap. For now, process.env with defaults is acceptable
 *   since missing secrets cause runtime failures that surface immediately in testing.
 */
function buildJwtConfig(): JwtConfig {
  const accessSecret = process.env['JWT_ACCESS_SECRET'];
  const refreshSecret = process.env['JWT_REFRESH_SECRET'];

  if (!accessSecret || accessSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must be at least 32 characters. Set it in your .env file.');
  }
  if (!refreshSecret || refreshSecret.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be at least 32 characters. Set it in your .env file.');
  }

  return {
    accessSecret,
    refreshSecret,
    accessExpiresIn: parseInt(process.env['JWT_ACCESS_EXPIRES'] ?? '900', 10),
    refreshExpiresIn: parseInt(process.env['JWT_REFRESH_EXPIRES'] ?? '604800', 10),
    mfaChallengeExpiresIn: parseInt(process.env['JWT_MFA_CHALLENGE_EXPIRES'] ?? '300', 10),
  };
}

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),   // JwtTokenService handles signing config directly
    IdentityModule,           // exports USER_REPOSITORY
    forwardRef(() => SettingsModule),
    RedisModule,
  ],
  controllers: [AuthController],
  providers: [
    // ── Repository providers ─────────────────────────────────────────────────
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: PrismaRefreshTokenRepository },
    { provide: LOGIN_ATTEMPT_REPOSITORY, useClass: PrismaLoginAttemptRepository },
    { provide: PASSWORD_RESET_TOKEN_REPOSITORY, useClass: PrismaPasswordResetTokenRepository },
    { provide: EMAIL_VERIFICATION_TOKEN_REPOSITORY, useClass: PrismaEmailVerificationTokenRepository },
    { provide: MFA_BACKUP_CODE_REPOSITORY, useClass: PrismaMfaBackupCodeRepository },
    { provide: TRUSTED_DEVICE_REPOSITORY, useClass: PrismaTrustedDeviceRepository },

    // ── Service providers ─────────────────────────────────────────────────────
    { provide: EMAIL_SENDER, useClass: ConsoleEmailSender },
    InMemoryRateLimiter,
    RedisRateLimiter,
    {
      provide: RATE_LIMITER,
      useFactory: (redis: RedisRateLimiter, memory: InMemoryRateLimiter) =>
        process.env.NODE_ENV === 'test' ? memory : redis,
      inject: [RedisRateLimiter, InMemoryRateLimiter],
    },

    // ── JWT infrastructure ────────────────────────────────────────────────────
    // JwtConfig is built once at module init and shared across all consumers.
    // Previously buildJwtConfig() was called twice — once per factory — which
    // caused double validation errors on missing secrets and inconsistent config.
    {
      provide: 'JWT_CONFIG',
      useFactory: (): JwtConfig => buildJwtConfig(),
    },
    {
      provide: JwtTokenService,
      useFactory: (jwtService: JwtService, cfg: JwtConfig) => new JwtTokenService(jwtService, cfg),
      inject: [JwtService, 'JWT_CONFIG'],
    },
    {
      provide: JwtStrategy,
      useFactory: (cfg: JwtConfig, sessionCache: SessionCacheService) =>
        new JwtStrategy(cfg.accessSecret, sessionCache),
      inject: ['JWT_CONFIG', SessionCacheService],
    },

    // ── Tenant resolver: upgrade to JWT-based ────────────────────────────────
    { provide: TENANT_RESOLVER, useClass: JwtTenantResolver },

    // ── Application handlers ─────────────────────────────────────────────────
    LoginHandler,
    LogoutHandler,
    LogoutAllHandler,
    RefreshTokenHandler,
    ForgotPasswordHandler,
    ResetPasswordHandler,
    VerifyEmailHandler,
    SendVerificationEmailHandler,
    ListSessionsHandler,
    ChangePasswordHandler,
    GetMeHandler,
    VerifyMfaHandler,
    SetupMfaHandler,
    ConfirmMfaHandler,
    DisableMfaHandler,
    RevokeSessionHandler,
    RegenerateMfaBackupCodesHandler,
    LoginCompletionService,
    TotpService,
    MfaBackupCodeService,

    // ── Guards (exported for global registration in AppModule) ───────────────
    JwtAuthGuard,
    RolesGuard,
    PermissionGuard,
  ],
  exports: [
    JwtAuthGuard,
    RolesGuard,
    PermissionGuard,
    JwtTokenService,
    REFRESH_TOKEN_REPOSITORY,
    TENANT_RESOLVER,
  ],
})
export class AuthModule {}
