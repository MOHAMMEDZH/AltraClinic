import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import {
  LOGIN_ATTEMPT_REPOSITORY,
  PASSWORD_RESET_TOKEN_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
  USER_REPOSITORY,
  EMAIL_VERIFICATION_TOKEN_REPOSITORY,
} from '../../../../infrastructure/provider.tokens';
import { EmailSenderPort, EMAIL_SENDER } from '../../../auth/infrastructure/services/email-sender.port';
import { PasswordResetToken } from '../../../auth/domain/entities/password-reset-token.entity';
import { EmailVerificationToken } from '../../../auth/domain/entities/email-verification-token.entity';
import { LoginAttemptRepository } from '../../../auth/domain/repositories/login-attempt.repository.interface';
import { RefreshTokenRepository } from '../../../auth/domain/repositories/refresh-token.repository.interface';
import { PasswordResetTokenRepository } from '../../../auth/domain/repositories/password-reset-token.repository.interface';
import { EmailVerificationTokenRepository } from '../../../auth/domain/repositories/email-verification-token.repository.interface';
import { UserRepository } from '../../domain/user.repository.interface';
import { IdentityAuditLog, IDENTITY_AUDIT_LOG } from '../ports/identity-audit-log.port';
import { RegisterUserHandler } from './register-user.handler';
import { DeactivateUserHandler, ReactivateUserHandler } from './user-management.handlers';
import { ALL_ROLES, UserRole } from '../../domain/user.entity';
import { toUserSummaryDto } from '../mappers/user.mapper';
import { IdentityNotificationService } from '../services/identity-notification.service';
@Injectable()
export class GetUserLoginHistoryHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(LOGIN_ATTEMPT_REPOSITORY) private readonly loginAttempts: LoginAttemptRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string) {
    const tenant = await this.tenantContext.resolve();
    const user = await this.userRepo.findById(userId, tenant.tenantId);
    if (!user) return null;

    const attempts = await this.loginAttempts.listByEmail(user.email, tenant.tenantId, 50);
    return attempts.map((a) => ({
      id: a.id,
      success: a.success,
      failReason: a.failReason,
      ipAddress: a.ipAddress,
      userAgent: a.userAgent,
      attemptedAt: a.attemptedAt.toISOString(),
    }));
  }
}

@Injectable()
export class GetUserSessionsHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly sessions: RefreshTokenRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string) {
    const tenant = await this.tenantContext.resolve();
    const user = await this.userRepo.findById(userId, tenant.tenantId);
    if (!user) return null;

    const tokens = await this.sessions.findActiveByUserId(userId, tenant.tenantId);
    return tokens.map((t) => ({
      sessionId: t.sessionId,
      deviceName: t.deviceName,
      ipAddress: t.ipAddress,
      userAgent: t.userAgent,
      createdAt: t.createdAt.toISOString(),
      expiresAt: t.expiresAt.toISOString(),
    }));
  }
}

@Injectable()
export class RevokeUserSessionHandler {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly sessions: RefreshTokenRepository,
    @Inject(IDENTITY_AUDIT_LOG) private readonly audit: IdentityAuditLog,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, sessionId: string, actorId: string, actorRoles: string[]) {
    const tenant = await this.tenantContext.resolve();
    await this.sessions.revokeBySessionId(sessionId);
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'identity.user.session_revoked',
      resourceId: userId,
      actorId,
      actorRoles,
      locale: tenant.locale ?? null,
      details: { sessionId },
    });
    return { ok: true };
  }
}

@Injectable()
export class RevokeAllUserSessionsHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly sessions: RefreshTokenRepository,
    @Inject(IDENTITY_AUDIT_LOG) private readonly audit: IdentityAuditLog,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, actorId: string, actorRoles: string[]) {
    const tenant = await this.tenantContext.resolve();
    const user = await this.userRepo.findById(userId, tenant.tenantId);
    if (!user) return null;

    await this.sessions.revokeAllByUserId(userId);
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'identity.user.sessions_revoked_all',
      resourceId: userId,
      actorId,
      actorRoles,
      locale: tenant.locale ?? null,
    });
    return { ok: true };
  }
}

@Injectable()
export class ForcePasswordResetHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY) private readonly tokenRepo: PasswordResetTokenRepository,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSenderPort,
    @Inject(IDENTITY_AUDIT_LOG) private readonly audit: IdentityAuditLog,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, actorId: string, actorRoles: string[], ipAddress = '0.0.0.0') {
    const tenant = await this.tenantContext.resolve();
    const user = await this.userRepo.findById(userId, tenant.tenantId);
    if (!user) return null;

    await this.tokenRepo.invalidateAllForUser(userId);
    const [token, rawToken] = PasswordResetToken.generate({
      userId: user.id,
      tenantId: user.tenantId,
      ipAddress,
      ttlMinutes: 60,
    });
    await this.tokenRepo.save(token);
    await this.emailSender.sendPasswordReset(user.email, rawToken);

    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'identity.user.password_reset_forced',
      resourceId: userId,
      actorId,
      actorRoles,
      locale: tenant.locale ?? null,
    });

    return { ok: true };
  }
}

@Injectable()
export class ResendVerificationHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(EMAIL_VERIFICATION_TOKEN_REPOSITORY) private readonly tokenRepo: EmailVerificationTokenRepository,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSenderPort,
    @Inject(IDENTITY_AUDIT_LOG) private readonly audit: IdentityAuditLog,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, actorId: string, actorRoles: string[]) {
    const tenant = await this.tenantContext.resolve();
    const user = await this.userRepo.findById(userId, tenant.tenantId);
    if (!user || user.emailVerified) return null;

    await this.tokenRepo.invalidateAllForUser(userId);
    const [token, rawToken] = EmailVerificationToken.generate({ userId, tenantId: tenant.tenantId, ttlHours: 48 });
    await this.tokenRepo.save(token);
    await this.emailSender.sendEmailVerification(user.email, rawToken);

    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'identity.user.verification_resent',
      resourceId: userId,
      actorId,
      actorRoles,
      locale: tenant.locale ?? null,
    });

    return { ok: true };
  }
}

@Injectable()
export class SoftDeleteUserHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly sessions: RefreshTokenRepository,
    @Inject(IDENTITY_AUDIT_LOG) private readonly audit: IdentityAuditLog,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, actorId: string, actorRoles: string[]) {
    const tenant = await this.tenantContext.resolve();
    const user = await this.userRepo.findById(userId, tenant.tenantId);
    if (!user) return null;

    await this.userRepo.softDelete(userId, tenant.tenantId);
    await this.sessions.revokeAllByUserId(userId);

    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'identity.user.deleted',
      resourceId: userId,
      actorId,
      actorRoles,
      locale: tenant.locale ?? null,
    });

    return { ok: true };
  }
}

@Injectable()
export class BulkUserActionHandler {
  constructor(
    @Inject(IDENTITY_AUDIT_LOG) private readonly audit: IdentityAuditLog,
    private readonly tenantContext: TenantContextService,
    private readonly deactivateHandler: DeactivateUserHandler,
    private readonly reactivateHandler: ReactivateUserHandler,
  ) {}

  async execute(input: {
    userIds: string[];
    action: 'deactivate' | 'reactivate';
    actorId: string;
    actorRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    const results: string[] = [];

    for (const userId of input.userIds) {
      const handler = input.action === 'deactivate' ? this.deactivateHandler : this.reactivateHandler;
      const result = await handler.execute(userId, input.actorId, input.actorRoles);
      if (result) results.push(userId);
    }

    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: `identity.user.bulk_${input.action}`,
      resourceId: tenant.tenantId,
      actorId: input.actorId,
      actorRoles: input.actorRoles,
      locale: tenant.locale ?? null,
      details: { userIds: results, count: results.length },
    });

    return { processed: results.length, userIds: results };
  }
}

@Injectable()
export class InviteStaffUserHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly registerHandler: RegisterUserHandler,
    @Inject(IDENTITY_AUDIT_LOG) private readonly audit: IdentityAuditLog,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY) private readonly tokenRepo: PasswordResetTokenRepository,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSenderPort,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    private readonly notifications: IdentityNotificationService,
  ) {}

  async execute(input: {
    email: string;
    roles?: UserRole[];
    firstName?: string;
    lastName?: string;
    firstNameAr?: string;
    lastNameAr?: string;
    phone?: string;
    branchId?: string | null;
    invitedBy: string;
    invitedByRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    const email = input.email.toLowerCase().trim();

    const existingUser = await this.userRepo.findByEmail(email, tenant.tenantId);
    if (existingUser) throw new ConflictException('User with this email already exists');

    const pendingInvite = await this.prisma.staffInvitation.findFirst({
      where: { tenantId: tenant.tenantId, email, status: 'PENDING', expiresAt: { gt: new Date() } },
    });
    if (pendingInvite) throw new ConflictException('A pending invitation already exists for this email');

    const roles = (input.roles ?? ['receptionist']).filter((r) => ALL_ROLES.includes(r));
    const tempPassword = randomBytes(16).toString('base64url');

    const { userId } = await this.registerHandler.execute({
      email,
      password: tempPassword,
      roles,
      firstName: input.firstName ?? '',
      lastName: input.lastName ?? '',
      firstNameAr: input.firstNameAr,
      lastNameAr: input.lastNameAr,
      phone: input.phone,
      branchId: input.branchId ?? tenant.branchId ?? null,
    });

    const expiresAt = new Date(Date.now() + 7 * 86_400_000);
    const invitation = await this.prisma.staffInvitation.create({
      data: {
        tenantId: tenant.tenantId,
        branchId: input.branchId ?? tenant.branchId ?? null,
        email,
        roles,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        firstNameAr: input.firstNameAr ?? null,
        lastNameAr: input.lastNameAr ?? null,
        phone: input.phone ?? null,
        invitedBy: input.invitedBy,
        status: 'PENDING',
        expiresAt,
        userId,
      },
    });

    await this.tokenRepo.invalidateAllForUser(userId);
    const [token, rawToken] = PasswordResetToken.generate({
      userId,
      tenantId: tenant.tenantId,
      ipAddress: '0.0.0.0',
      ttlMinutes: 60 * 24,
    });
    await this.tokenRepo.save(token);
    await this.emailSender.sendPasswordReset(email, rawToken);

    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: input.branchId ?? tenant.branchId ?? null,
      action: 'identity.user.invited',
      resourceId: userId,
      actorId: input.invitedBy,
      actorRoles: input.invitedByRoles,
      locale: tenant.locale ?? null,
      details: { invitationId: invitation.id, email },
      descriptionEn: 'Staff user invited',
      descriptionAr: 'تمت دعوة موظف',
    });

    await this.notifications.userInvited(userId, input.branchId ?? tenant.branchId ?? null);

    const user = await this.userRepo.findById(userId, tenant.tenantId);
    if (!user) throw new NotFoundException('User not found after invite');
    return { invitationId: invitation.id, user: toUserSummaryDto(user) };
  }
}

@Injectable()
export class ListStaffInvitationsHandler {
  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService) {}

  async execute() {
    const tenant = await this.tenantContext.resolve();
    const rows = await this.prisma.staffInvitation.findMany({
      where: { tenantId: tenant.tenantId, status: 'PENDING', expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      roles: row.roles as string[],
      firstName: row.firstName,
      lastName: row.lastName,
      branchId: row.branchId,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    }));
  }
}

@Injectable()
export class CancelStaffInvitationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(IDENTITY_AUDIT_LOG) private readonly audit: IdentityAuditLog,
  ) {}

  async execute(invitationId: string, actorId: string, actorRoles: string[]) {
    const tenant = await this.tenantContext.resolve();
    const invite = await this.prisma.staffInvitation.findFirst({
      where: { id: invitationId, tenantId: tenant.tenantId, status: 'PENDING' },
    });
    if (!invite) return null;

    await this.prisma.staffInvitation.update({
      where: { id: invitationId },
      data: { status: 'CANCELLED', updatedAt: new Date() },
    });

    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: invite.branchId,
      action: 'identity.user.invitation_cancelled',
      resourceId: invite.userId ?? invitationId,
      actorId,
      actorRoles,
      locale: tenant.locale ?? null,
      details: { invitationId, email: invite.email },
    });

    return { ok: true };
  }
}
