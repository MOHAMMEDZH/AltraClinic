import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards, ForbiddenException, NotFoundException, Inject, Logger } from '@nestjs/common';
import { CurrentUser } from './decorators/current-user.decorator';
import { PlatformAuthRoute } from './decorators/platform-auth-route.decorator';
import { RequirePlatformPermission } from './decorators/require-platform-permission.decorator';
import { PlatformPermissionGuard } from './guards/platform-permission.guard';
import { JwtClaimsVO } from '../domain/value-objects/jwt-claims.vo';
import { PrismaPlatformUserRepository } from '../infrastructure/repositories/prisma-platform-user.repository';
import { PlatformUserRoleRepository, PlatformInvitationRepository, PlatformMfaResetRepository } from '../infrastructure/repositories/prisma-platform-rbac.repositories';
import { PlatformAuthorizationService } from '../platform-rbac/platform-authorization.service';
import { PlatformSodService } from '../platform-rbac/platform-sod.service';
import { PLATFORM_ROLE_KEY_SET, HIGH_IMPACT_ROLE_KEYS } from '../platform-rbac/platform-rbac.catalog';
import { PlatformAssuranceService } from '../application/services/platform-assurance.service';
import { PlatformSessionRevocationService } from '../application/services/platform-session-revocation.service';
import { PlatformRefreshTokenRepository } from '../domain/repositories/platform-refresh-token.repository.interface';
import { PLATFORM_REFRESH_TOKEN_REPOSITORY } from '../platform-auth.tokens';
import { summarizeUserAgent } from '../application/platform-device-summary';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PLATFORM_RBAC_CONFIG, PlatformRbacConfig } from '../platform-rbac/config/platform-rbac-config';
import {
  PLATFORM_INVITATION_DELIVERY,
  PlatformInvitationDeliveryPort,
} from '../infrastructure/services/platform-invitation-delivery.port';
import { PasswordHasher } from '../../identity/infrastructure/password-hasher';
import { PlatformUser } from '../domain/entities/platform-user.entity';
import {
  mapPlatformAdminSession,
  mapPlatformInvitationAdmin,
  mapPlatformMfaResetRequest,
  mapPlatformUserDetail,
  mapPlatformUserListItem,
  mapPlatformUserListResponse,
} from '../platform-rbac/platform-response.mappers';
import { PlatformUserAdminMutationsService } from '../application/services/platform-user-admin-mutations.service';
import { resolveOperationCorrelationId } from '../../platform-audit-center/application/operation-correlation';

@Controller('platform/users')
@PlatformAuthRoute()
@UseGuards(PlatformPermissionGuard)
export class PlatformUsersController {
  private readonly logger = new Logger(PlatformUsersController.name);

  constructor(
    private readonly users: PrismaPlatformUserRepository,
    private readonly roles: PlatformUserRoleRepository,
    private readonly invitations: PlatformInvitationRepository,
    private readonly resets: PlatformMfaResetRepository,
    private readonly authz: PlatformAuthorizationService,
    private readonly sod: PlatformSodService,
    private readonly assurance: PlatformAssuranceService,
    private readonly revocations: PlatformSessionRevocationService,
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY) private readonly refreshes: PlatformRefreshTokenRepository,
    private readonly prisma: PrismaService,
    @Inject(PLATFORM_RBAC_CONFIG) private readonly config: PlatformRbacConfig,
    @Inject(PLATFORM_INVITATION_DELIVERY) private readonly invitationDelivery: PlatformInvitationDeliveryPort,
    private readonly adminMutations: PlatformUserAdminMutationsService,
  ) {}

  private async stepUp(c: JwtClaimsVO) {
    const s = await this.refreshes.findBySessionId(c.sessionId);
    if (!s) throw new ForbiddenException('Session unavailable.');
    this.assurance.requireStepUp(s);
  }

  @Get()
  @RequirePlatformPermission('platform-user.view')
  async list(@Query() q: { page?: string; pageSize?: string; search?: string; status?: string; roleKey?: string }) {
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 25));
    const result = await this.users.list({ page, pageSize, search: q.search, status: q.status, roleKey: q.roleKey });
    const items = await Promise.all(
      result.items.map(async (user) => {
        const [roleKeys, activeSessionCount] = await Promise.all([
          this.authz.resolveActiveRoleKeys(user.id),
          this.prisma.platformRefreshToken.count({ where: { platformUserId: user.id, revokedAt: null } }),
        ]);
        return mapPlatformUserListItem(user, { roleKeys, activeSessionCount });
      }),
    );
    return mapPlatformUserListResponse({ items, page, pageSize, total: result.total });
  }

  @Get(':id')
  @RequirePlatformPermission('platform-user.view')
  async detail(@Param('id') id: string) {
    const u = await this.users.findById(id);
    if (!u) throw new NotFoundException();
    const roleKeys = await this.authz.resolveActiveRoleKeys(id);
    const activeSessionCount = await this.prisma.platformRefreshToken.count({
      where: { platformUserId: id, revokedAt: null },
    });
    return mapPlatformUserDetail(u, { roleKeys, activeSessionCount });
  }

  @Post('invitations')
  @RequirePlatformPermission('platform-user.invite')
  async invite(
    @CurrentUser() c: JwtClaimsVO,
    @Body() b: { email: string; displayName?: string; roleKeys: string[]; reason?: string },
  ) {
    await this.stepUp(c);
    if (!b.roleKeys?.length || b.roleKeys.some((r) => !PLATFORM_ROLE_KEY_SET.has(r))) {
      throw new ForbiddenException('Invalid role selection.');
    }
    const email = b.email.toLowerCase().trim();
    const existing = await this.users.findByEmail(email);
    if (existing) throw new ForbiddenException('Platform user already exists.');
    const passwordHash = await PasswordHasher.hash(randomBytes(32).toString('hex'));
    const now = new Date();
    const user = PlatformUser.restore({
      id: randomUUID(),
      email,
      passwordHash,
      displayName: b.displayName ?? null,
      isActive: true,
      status: 'pending_activation',
      suspendedAt: null,
      suspendedReason: null,
      suspendedById: null,
      authzRevision: 0,
      lockedUntil: null,
      failedLoginCount: 0,
      passwordChangedAt: now,
      lastLoginAt: null,
      lastLoginIp: null,
      createdAt: now,
      updatedAt: now,
      mfaEnabled: false,
      mfaSecretEncrypted: null,
      mfaKeyVersion: '1',
      mfaPendingSecretEncrypted: null,
      mfaPendingExpiresAt: null,
      mfaConfirmedAt: null,
      lastTotpStep: null,
      failedMfaCount: 0,
    });
    await this.users.save(user);
    for (const roleKey of b.roleKeys) {
      await this.roles.assign({ platformUserId: user.id, roleKey, assignedById: c.sub, reason: b.reason });
    }
    const raw = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.invitationTtlSeconds * 1000);
    const invitation = await this.invitations.create({
      platformUserId: user.id,
      email: user.email,
      tokenHash: createHash('sha256').update(raw).digest('hex'),
      invitedById: c.sub,
      roleKeysJson: JSON.stringify(b.roleKeys),
      expiresAt,
    });
    const activationUrl = `${this.config.invitationAppOrigin}/activate?token=${encodeURIComponent(raw)}`;
    let delivery = null;
    try {
      delivery = await this.invitationDelivery.deliver({
        recipientEmail: user.email,
        activationUrl,
        invitationId: invitation.id,
        platformUserId: user.id,
        expiresAt,
        correlationId: resolveOperationCorrelationId({ explicit: null }),
        templateId: 'platform_user_invitation',
      });
    } catch (err) {
      this.logger.warn(
        `Invitation created but delivery failed invitationId=${invitation.id} platformUserId=${user.id} status=pending`,
      );
      return mapPlatformInvitationAdmin({
        invitationId: invitation.id,
        platformUserId: user.id,
        status: invitation.status ?? 'pending',
        expiresAt,
        createdAt: invitation.createdAt ?? now,
        delivery: {
          invitationId: invitation.id,
          platformUserId: user.id,
          channel: 'none',
          deliveryStatus: 'failed',
          recipientRedacted: '***',
        },
      });
    }
    this.logger.log(
      `Invitation created invitationId=${invitation.id} platformUserId=${user.id} deliveryStatus=${delivery.deliveryStatus}`,
    );
    return mapPlatformInvitationAdmin({
      invitationId: invitation.id,
      platformUserId: user.id,
      status: invitation.status ?? 'pending',
      expiresAt,
      createdAt: invitation.createdAt ?? now,
      delivery,
    });
  }

  @Post(':id/suspend')
  @RequirePlatformPermission('platform-user.suspend')
  async suspend(@CurrentUser() c: JwtClaimsVO, @Param('id') id: string, @Body() b: { reason: string }) {
    if (!b.reason?.trim()) throw new ForbiddenException('Suspension reason is required.');
    await this.stepUp(c);
    await this.sod.assertCanSuspend(c.sub, id);
    await this.users.updateLifecycle(id, {
      status: 'suspended',
      isActive: false,
      suspendedAt: new Date(),
      suspendedById: c.sub,
      suspendedReason: b.reason.trim(),
    });
    await this.authz.bumpAuthzRevision(id);
    await this.revocations.revokeAllForUser(id, 'suspended');
    await this.invitations.supersedePending(id);
    return { ok: true };
  }

  @Post(':id/invitations/resend')
  @RequirePlatformPermission('platform-user.invite')
  async resend(@CurrentUser() c: JwtClaimsVO, @Param('id') id: string) {
    await this.stepUp(c);
    const user = await this.users.findById(id);
    if (!user || user.status !== 'pending_activation') throw new NotFoundException();
    const since = new Date(Date.now() - 3_600_000);
    if (
      (await this.prisma.platformUserInvitation.count({
        where: { platformUserId: id, createdAt: { gte: since } },
      })) >= this.config.invitationResendLimit
    ) {
      throw new ForbiddenException('Invitation resend limit exceeded.');
    }
    const active = await this.roles.listActive(id);
    const raw = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.invitationTtlSeconds * 1000);
    const invitation = await this.invitations.supersedeAndCreate({
      platformUserId: id,
      email: user.email,
      tokenHash: createHash('sha256').update(raw).digest('hex'),
      invitedById: c.sub,
      roleKeysJson: JSON.stringify(active.map((x) => x.roleKey)),
      expiresAt,
    });
    const activationUrl = `${this.config.invitationAppOrigin}/activate?token=${encodeURIComponent(raw)}`;
    let delivery = null;
    try {
      delivery = await this.invitationDelivery.deliver({
        recipientEmail: user.email,
        activationUrl,
        invitationId: invitation.id,
        platformUserId: id,
        expiresAt,
        correlationId: resolveOperationCorrelationId({ explicit: null }),
        templateId: 'platform_user_invitation',
      });
    } catch {
      this.logger.warn(`Invitation resend delivery failed invitationId=${invitation.id} platformUserId=${id}`);
      return mapPlatformInvitationAdmin({
        invitationId: invitation.id,
        platformUserId: id,
        status: invitation.status ?? 'pending',
        expiresAt,
        createdAt: invitation.createdAt ?? new Date(),
        delivery: {
          invitationId: invitation.id,
          platformUserId: id,
          channel: 'none',
          deliveryStatus: 'failed',
          recipientRedacted: '***',
        },
      });
    }
    return mapPlatformInvitationAdmin({
      invitationId: invitation.id,
      platformUserId: id,
      status: invitation.status ?? 'pending',
      expiresAt,
      createdAt: invitation.createdAt ?? new Date(),
      delivery,
    });
  }

  @Post(':id/reactivate')
  @RequirePlatformPermission('platform-user.activate')
  async reactivate(@CurrentUser() c: JwtClaimsVO, @Param('id') id: string, @Body() b: { reason?: string }) {
    if (!b?.reason?.trim()) throw new ForbiddenException('Reactivation reason is required.');
    await this.stepUp(c);
    await this.users.updateLifecycle(id, {
      status: 'active',
      isActive: true,
      suspendedAt: null,
      suspendedById: null,
      suspendedReason: null,
    });
    await this.authz.bumpAuthzRevision(id);
    return { ok: true };
  }

  @Post(':id/roles')
  @RequirePlatformPermission('platform-user.role.assign')
  async assign(
    @CurrentUser() c: JwtClaimsVO,
    @Param('id') id: string,
    @Body() b: { roleKey: string; reason?: string },
  ) {
    await this.adminMutations.assignRole(c, id, b);
    return { ok: true };
  }

  @Delete(':id/roles/:roleKey')
  @RequirePlatformPermission('platform-user.role.remove')
  async remove(@CurrentUser() c: JwtClaimsVO, @Param('id') id: string, @Param('roleKey') roleKey: string) {
    await this.stepUp(c);
    await this.sod.assertCanRemoveRole(id, roleKey);
    await this.roles.revoke(id, roleKey, c.sub);
    await this.authz.bumpAuthzRevision(id);
    return { ok: true };
  }

  @Get(':id/sessions')
  @RequirePlatformPermission('platform-user.session.view')
  async sessions(@Param('id') id: string) {
    const rows = await this.prisma.platformRefreshToken.findMany({
      where: { platformUserId: id, revokedAt: null },
      select: {
        sessionId: true,
        userAgent: true,
        createdAt: true,
        lastActivityAt: true,
      },
    });
    return rows.map((row) => {
      const device = summarizeUserAgent(row.userAgent);
      return mapPlatformAdminSession({
        sessionId: row.sessionId,
        createdAt: row.createdAt,
        lastInteractiveActivityAt: row.lastActivityAt,
        deviceSummary: device.summary,
        deviceCategory: device.category,
        revoked: false,
      });
    });
  }

  @Post(':id/sessions/:sessionId/revoke')
  @RequirePlatformPermission('platform-user.session.revoke')
  async revokeSession(
    @CurrentUser() c: JwtClaimsVO,
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @Body() b: { reason?: string },
  ) {
    await this.adminMutations.revokeSession(c, id, sessionId, b?.reason ?? '');
    return { ok: true };
  }

  @Post(':id/sessions/revoke-all')
  @RequirePlatformPermission('platform-user.session.revoke')
  async revokeAll(@CurrentUser() c: JwtClaimsVO, @Param('id') id: string, @Body() b: { reason?: string }) {
    if (!b?.reason?.trim()) throw new ForbiddenException('Revocation reason is required.');
    await this.stepUp(c);
    this.sod.assertNotSelf(c.sub, id, 'revoke all sessions for');
    await this.revocations.revokeAllForUser(id, 'admin_revoked');
    return { ok: true };
  }

  @Post(':id/mfa-reset-requests')
  @RequirePlatformPermission('platform-user.mfa.reset-request')
  @HttpCode(HttpStatus.CREATED)
  async requestReset(
    @CurrentUser() c: JwtClaimsVO,
    @Param('id') id: string,
    @Body() b: { reason: string; externalRef?: string },
  ) {
    if (!b.reason?.trim()) throw new ForbiddenException('MFA reset reason is required.');
    await this.stepUp(c);
    this.sod.assertNotSelf(c.sub, id, 'request an MFA reset for');
    const row = await this.resets.create({
      targetUserId: id,
      requesterId: c.sub,
      reason: b.reason.trim(),
      externalRef: b.externalRef,
      expiresAt: new Date(Date.now() + this.config.mfaResetTtlSeconds * 1000),
    });
    return mapPlatformMfaResetRequest(row);
  }
}
