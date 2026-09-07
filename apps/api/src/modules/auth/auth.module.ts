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
import { PrismaPlatformMfaRecoveryCodeRepository } from './infrastructure/repositories/prisma-platform-mfa-recovery-code.repository';
import { JwtTokenService } from './infrastructure/services/jwt-token.service';
import { PlatformMfaService } from './infrastructure/services/platform-mfa.service';
import {
  loadPlatformSecurityConfig,
  PLATFORM_SECURITY_CONFIG,
  PlatformSecurityConfig,
} from './config/platform-security.config';
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

// Platform MFA/session application services (Phase 47 Step 07)
import { PlatformSessionCompletionService } from './application/services/platform-session-completion.service';
import { PlatformAssuranceService } from './application/services/platform-assurance.service';
import { PlatformSessionPolicyService } from './application/services/platform-session-policy.service';
import { PlatformSessionRevocationService } from './application/services/platform-session-revocation.service';

// Platform MFA/session handlers (Phase 47 Step 07)
import { PlatformMfaBeginEnrollmentHandler } from './application/handlers/platform-mfa-begin-enrollment.handler';
import { PlatformMfaConfirmEnrollmentHandler } from './application/handlers/platform-mfa-confirm-enrollment.handler';
import { PlatformMfaVerifyChallengeHandler } from './application/handlers/platform-mfa-verify-challenge.handler';
import { PlatformMfaStatusHandler } from './application/handlers/platform-mfa-status.handler';
import { PlatformMfaRegenerateRecoveryCodesHandler } from './application/handlers/platform-mfa-regenerate-recovery-codes.handler';
import { PlatformMfaBeginReplaceHandler } from './application/handlers/platform-mfa-begin-replace.handler';
import { PlatformMfaConfirmReplaceHandler } from './application/handlers/platform-mfa-confirm-replace.handler';
import { PlatformListSessionsHandler } from './application/handlers/platform-list-sessions.handler';
import { PlatformRevokeSessionHandler } from './application/handlers/platform-revoke-session.handler';
import { PlatformRevokeOtherSessionsHandler } from './application/handlers/platform-revoke-other-sessions.handler';
import { PlatformRevokeAllSessionsHandler } from './application/handlers/platform-revoke-all-sessions.handler';
import { PlatformStepUpVerifyHandler } from './application/handlers/platform-step-up-verify.handler';
import { PlatformStepUpStatusHandler } from './application/handlers/platform-step-up-status.handler';
import { PlatformActivityHandler } from './application/handlers/platform-activity.handler';

// API layer
import { AuthController } from './api/auth.controller';
import { PlatformAuthController } from './api/platform-auth.controller';
import { PlatformSecurityController } from './api/platform-security.controller';
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
import {
  PLATFORM_MFA_RECOVERY_CODE_REPOSITORY,
  PLATFORM_REFRESH_TOKEN_REPOSITORY,
  PLATFORM_USER_REPOSITORY,
} from './platform-auth.tokens';
import { EMAIL_SENDER } from './infrastructure/services/email-sender.port';
import { PLATFORM_INVITATION_DELIVERY } from './infrastructure/services/platform-invitation-delivery.port';
import { DevMailboxPlatformInvitationDelivery } from './infrastructure/services/dev-mailbox-platform-invitation.delivery';
import { RATE_LIMITER } from './infrastructure/services/rate-limiter.port';

// Shared identity module for UserRepository
import { IdentityModule } from '../identity/identity.module';
import { SettingsModule } from '../settings/settings.module';
import { JwtConfig } from './infrastructure/services/jwt-token.service';
import { SessionCacheService } from '../../infrastructure/redis/services/session-cache.service';
import { PrismaService } from '../../infrastructure/prisma.service';
import { PlatformLoginHandler } from './application/handlers/platform-login.handler';
import { PlatformRefreshHandler } from './application/handlers/platform-refresh.handler';
import { PlatformLogoutHandler } from './application/handlers/platform-logout.handler';
import { PlatformMeHandler } from './application/handlers/platform-me.handler';
import { PrismaPlatformUserRepository } from './infrastructure/repositories/prisma-platform-user.repository';
import { PrismaPlatformRefreshTokenRepository } from './infrastructure/repositories/prisma-platform-refresh-token.repository';
import { PlatformUsersController } from './api/platform-users.controller';
import { PlatformRbacCatalogController } from './api/platform-rbac-catalog.controller';
import { PlatformMfaResetController } from './api/platform-mfa-reset.controller';
import { PlatformPermissionGuard } from './api/guards/platform-permission.guard';
import { PlatformAuthorizationService } from './platform-rbac/platform-authorization.service';
import { PlatformSodService } from './platform-rbac/platform-sod.service';
import { PlatformInvitationRepository, PlatformMfaResetRepository, PlatformUserRoleRepository } from './infrastructure/repositories/prisma-platform-rbac.repositories';
import { loadPlatformRbacConfig, PLATFORM_RBAC_CONFIG, PlatformRbacConfig } from './platform-rbac/config/platform-rbac-config';
import { PlatformInvitationAcceptanceService } from './application/services/platform-invitation-acceptance.service';
import { PlatformMfaResetDecisionService } from './application/services/platform-mfa-reset-decision.service';
import { AuditTrailPlatformSecurityAuditLog } from './infrastructure/audit-trail-platform-security-audit-log';
import { PlatformUserAdminMutationsService } from './application/services/platform-user-admin-mutations.service';

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

  const nodeEnv = process.env['NODE_ENV'] ?? 'development';
  const platformAccessEnv = process.env['JWT_PLATFORM_ACCESS_SECRET'];
  const platformRefreshEnv = process.env['JWT_PLATFORM_REFRESH_SECRET'];

  let platformAccessSecret = platformAccessEnv;
  let platformRefreshSecret = platformRefreshEnv;
  let platformSecretsSharedWithClinic = false;

  if (!platformAccessSecret || platformAccessSecret.length < 32) {
    if (nodeEnv === 'production') {
      throw new Error(
        'JWT_PLATFORM_ACCESS_SECRET must be at least 32 characters in production.',
      );
    }
    platformAccessSecret = accessSecret;
    platformSecretsSharedWithClinic = true;
  }
  if (!platformRefreshSecret || platformRefreshSecret.length < 32) {
    if (nodeEnv === 'production') {
      throw new Error(
        'JWT_PLATFORM_REFRESH_SECRET must be at least 32 characters in production.',
      );
    }
    platformRefreshSecret = refreshSecret;
    platformSecretsSharedWithClinic = true;
  }

  return {
    accessSecret,
    refreshSecret,
    accessExpiresIn: parseInt(process.env['JWT_ACCESS_EXPIRES'] ?? '900', 10),
    refreshExpiresIn: parseInt(process.env['JWT_REFRESH_EXPIRES'] ?? '604800', 10),
    mfaChallengeExpiresIn: parseInt(process.env['JWT_MFA_CHALLENGE_EXPIRES'] ?? '300', 10),
    platformAccessSecret,
    platformRefreshSecret,
    platformIssuer: process.env['JWT_PLATFORM_ISSUER'] ?? 'booking-platform',
    platformAccessExpiresIn: parseInt(process.env['JWT_PLATFORM_ACCESS_EXPIRES'] ?? '900', 10),
    platformRefreshExpiresIn: parseInt(
      process.env['JWT_PLATFORM_REFRESH_EXPIRES'] ?? '604800',
      10,
    ),
    platformSecretsSharedWithClinic,
  };
}

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),   // JwtTokenService handles signing config directly
    forwardRef(() => IdentityModule),           // exports USER_REPOSITORY
    forwardRef(() => SettingsModule),
    RedisModule,
  ],
  controllers: [AuthController, PlatformAuthController, PlatformSecurityController, PlatformUsersController, PlatformRbacCatalogController, PlatformMfaResetController],
  providers: [
    // ── Repository providers ─────────────────────────────────────────────────
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: PrismaRefreshTokenRepository },
    { provide: LOGIN_ATTEMPT_REPOSITORY, useClass: PrismaLoginAttemptRepository },
    { provide: PASSWORD_RESET_TOKEN_REPOSITORY, useClass: PrismaPasswordResetTokenRepository },
    { provide: EMAIL_VERIFICATION_TOKEN_REPOSITORY, useClass: PrismaEmailVerificationTokenRepository },
    { provide: MFA_BACKUP_CODE_REPOSITORY, useClass: PrismaMfaBackupCodeRepository },
    { provide: TRUSTED_DEVICE_REPOSITORY, useClass: PrismaTrustedDeviceRepository },
    { provide: PLATFORM_USER_REPOSITORY, useClass: PrismaPlatformUserRepository },
    { provide: PLATFORM_REFRESH_TOKEN_REPOSITORY, useClass: PrismaPlatformRefreshTokenRepository },
    {
      provide: PLATFORM_MFA_RECOVERY_CODE_REPOSITORY,
      useClass: PrismaPlatformMfaRecoveryCodeRepository,
    },
    PlatformUserRoleRepository,
    PlatformInvitationRepository,
    PlatformMfaResetRepository,
    PlatformAuthorizationService,
    PlatformSodService,
    PlatformPermissionGuard,
    PlatformInvitationAcceptanceService,
    PlatformMfaResetDecisionService,
    AuditTrailPlatformSecurityAuditLog,
    PlatformUserAdminMutationsService,
    { provide: PLATFORM_RBAC_CONFIG, useFactory: (): PlatformRbacConfig => loadPlatformRbacConfig() },

    // ── Platform security config (Phase 47 Step 07) ──────────────────────────
    {
      provide: PLATFORM_SECURITY_CONFIG,
      useFactory: (): PlatformSecurityConfig => loadPlatformSecurityConfig(),
    },
    PlatformMfaService,

    // ── Service providers ─────────────────────────────────────────────────────
    { provide: EMAIL_SENDER, useClass: ConsoleEmailSender },
    { provide: PLATFORM_INVITATION_DELIVERY, useClass: DevMailboxPlatformInvitationDelivery },
    InMemoryRateLimiter,
    RedisRateLimiter,
    {
      provide: RATE_LIMITER,
      useFactory: (redis: RedisRateLimiter, memory: InMemoryRateLimiter) =>
        process.env.NODE_ENV === 'test' ? memory : redis,
      inject: [RedisRateLimiter, InMemoryRateLimiter],
    },

    // ── JWT infrastructure ────────────────────────────────────────────────────
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
      useFactory: (
        cfg: JwtConfig,
        sessionCache: SessionCacheService,
        jwtTokenService: JwtTokenService,
        jwtService: JwtService,
        prisma: PrismaService,
      ) => new JwtStrategy(cfg, sessionCache, jwtTokenService, jwtService, prisma),
      inject: ['JWT_CONFIG', SessionCacheService, JwtTokenService, JwtService, PrismaService],
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
    PlatformLoginHandler,
    PlatformRefreshHandler,
    PlatformLogoutHandler,
    PlatformMeHandler,

    // ── Platform MFA/session application services (Phase 47 Step 07) ─────────
    PlatformSessionCompletionService,
    PlatformAssuranceService,
    PlatformSessionPolicyService,
    PlatformSessionRevocationService,

    // ── Platform MFA/session handlers (Phase 47 Step 07) ─────────────────────
    PlatformMfaBeginEnrollmentHandler,
    PlatformMfaConfirmEnrollmentHandler,
    PlatformMfaVerifyChallengeHandler,
    PlatformMfaStatusHandler,
    PlatformMfaRegenerateRecoveryCodesHandler,
    PlatformMfaBeginReplaceHandler,
    PlatformMfaConfirmReplaceHandler,
    PlatformListSessionsHandler,
    PlatformRevokeSessionHandler,
    PlatformRevokeOtherSessionsHandler,
    PlatformRevokeAllSessionsHandler,
    PlatformStepUpVerifyHandler,
    PlatformStepUpStatusHandler,
    PlatformActivityHandler,

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
    LoginCompletionService,
    TotpService,
    MfaBackupCodeService,
    PlatformAuthorizationService,
    PlatformAssuranceService,
    PlatformSodService,
    PlatformPermissionGuard,
    REFRESH_TOKEN_REPOSITORY,
    LOGIN_ATTEMPT_REPOSITORY,
    PASSWORD_RESET_TOKEN_REPOSITORY,
    EMAIL_SENDER,
    PLATFORM_USER_REPOSITORY,
    PLATFORM_REFRESH_TOKEN_REPOSITORY,
    RATE_LIMITER,
    TENANT_RESOLVER,
    // Flexible Step 23 — Sales Representative Management reuses these existing
    // Platform invite/role/session SoRs rather than duplicating them.
    PlatformUserRoleRepository,
    PlatformInvitationRepository,
    PLATFORM_RBAC_CONFIG,
    PLATFORM_INVITATION_DELIVERY,
    PlatformSessionRevocationService,
  ],
})
export class AuthModule {}
