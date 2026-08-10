import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { JwtClaimsVO } from '../../domain/value-objects/jwt-claims.vo';
import {
  PlatformSessionRevokedEvent,
  PlatformSessionsRevokedBulkEvent,
} from '../../domain/events/auth.events';
import { PlatformRefreshTokenRepository } from '../../domain/repositories/platform-refresh-token.repository.interface';
import { PLATFORM_REFRESH_TOKEN_REPOSITORY } from '../../platform-auth.tokens';
import { PlatformAuthorizationService } from '../../platform-rbac/platform-authorization.service';
import { PlatformSodService } from '../../platform-rbac/platform-sod.service';
import { HIGH_IMPACT_ROLE_KEYS, PLATFORM_ROLE_KEY_SET } from '../../platform-rbac/platform-rbac.catalog';
import { AuditTrailPlatformSecurityAuditLog } from '../../infrastructure/audit-trail-platform-security-audit-log';
import {
  isPlatformSecurityAuditFailureInjectionActive,
  PlatformSecurityAuditInjectedFailure,
} from '../../platform-security-audit.constants';
import { resolveOperationCorrelationId } from '../../../platform-audit-center/application/operation-correlation';
import { PlatformAssuranceService } from './platform-assurance.service';

/**
 * Production mutation path for Platform user RBAC / session security (Step 21 A01/A02).
 * Model A: business mutation + immutable AuditEntry append in one PostgreSQL transaction.
 * No business success without durable evidence. No post-commit best-effort success audit.
 */
@Injectable()
export class PlatformUserAdminMutationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: PlatformAuthorizationService,
    private readonly sod: PlatformSodService,
    private readonly assurance: PlatformAssuranceService,
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY) private readonly refreshes: PlatformRefreshTokenRepository,
    private readonly securityAudit: AuditTrailPlatformSecurityAuditLog,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
  ) {}

  private maybeInject(point: string): void {
    if (!isPlatformSecurityAuditFailureInjectionActive(point)) return;
    throw new PlatformSecurityAuditInjectedFailure(point);
  }

  private async stepUp(c: JwtClaimsVO) {
    const s = await this.refreshes.findBySessionId(c.sessionId);
    if (!s) throw new ForbiddenException('Session unavailable.');
    this.assurance.requireStepUp(s);
  }

  async assignRole(
    actor: JwtClaimsVO,
    targetUserId: string,
    input: { roleKey: string; reason?: string },
  ): Promise<{ ok: true; audited: boolean }> {
    this.sod.assertNotSelf(actor.sub, targetUserId, 'assign roles');
    if (!PLATFORM_ROLE_KEY_SET.has(input.roleKey)) throw new ForbiddenException('Unknown role.');
    if (HIGH_IMPACT_ROLE_KEYS.has(input.roleKey)) await this.stepUp(actor);

    const reason = input.reason?.trim() || null;
    const result = await this.prisma.withPlatformBypass(async (tx) => {
      // Serialize concurrent assigns for the same target (one success audit).
      await tx.$queryRawUnsafe(
        `SELECT 1 FROM "platform_users" WHERE id = $1::uuid FOR UPDATE`,
        targetUserId,
      );

      const activeBefore = await tx.platformUserRole.findMany({
        where: { platformUserId: targetUserId, revokedAt: null },
        orderBy: { roleKey: 'asc' },
      });
      const alreadyActive = activeBefore.some((r) => r.roleKey === input.roleKey);

      await tx.platformUserRole.upsert({
        where: {
          platformUserId_roleKey: { platformUserId: targetUserId, roleKey: input.roleKey },
        },
        create: {
          platformUserId: targetUserId,
          roleKey: input.roleKey,
          assignedById: actor.sub,
          reason: reason ?? undefined,
        },
        update: {
          revokedAt: null,
          revokedById: null,
          revokeReason: null,
          assignedById: actor.sub,
          reason: reason ?? undefined,
          assignedAt: new Date(),
        },
      });

      this.authz.invalidateAuthzCache(targetUserId);
      await tx.platformUser.update({
        where: { id: targetUserId },
        data: { authzRevision: { increment: 1 } },
      });

      const revokedSessions = await tx.platformRefreshToken.updateMany({
        where: { platformUserId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date(), revocationReason: 'role_elevation' },
      });

      this.maybeInject('after_business_mutation_staging');

      if (!alreadyActive) {
        await this.securityAudit.appendInTransaction(tx, {
          action: 'platform.user.role.assigned',
          resourceId: targetUserId,
          actorId: actor.sub,
          actorRoles: ['platform'],
          reason,
          correlationId: resolveOperationCorrelationId(),
          details: { roleKey: input.roleKey },
          changes: { roleKey: { before: null, after: input.roleKey } },
        });
        this.maybeInject('after_audit_staging');
      }

      this.maybeInject('before_commit');
      return {
        ok: true as const,
        audited: !alreadyActive,
        revokedCount: revokedSessions.count,
      };
    });

    // Non-authoritative observability only (allowed post-commit).
    if (result.revokedCount > 0) {
      await this.events
        .publish(
          new PlatformSessionsRevokedBulkEvent(targetUserId, 'role_elevation', result.revokedCount),
        )
        .catch(() => undefined);
    }

    this.maybeInject('after_commit_before_response');
    return { ok: true, audited: result.audited };
  }

  async revokeSession(
    actor: JwtClaimsVO,
    targetUserId: string,
    sessionId: string,
    reason: string,
  ): Promise<{ ok: true }> {
    if (!reason?.trim()) throw new ForbiddenException('Revocation reason is required.');
    await this.stepUp(actor);
    this.sod.assertNotSelf(actor.sub, targetUserId, 'revoke sessions for');

    await this.prisma.withPlatformBypass(async (tx) => {
      const revoked = await tx.platformRefreshToken.updateMany({
        where: { sessionId, platformUserId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date(), revocationReason: 'admin_revoked' },
      });
      if (revoked.count !== 1) {
        throw new NotFoundException();
      }

      this.maybeInject('after_business_mutation_staging');

      await this.securityAudit.appendInTransaction(tx, {
        action: 'platform.user.session.revoked',
        resourceId: targetUserId,
        actorId: actor.sub,
        actorRoles: ['platform'],
        reason: reason.trim(),
        correlationId: resolveOperationCorrelationId(),
        details: { sessionIdRedacted: '[redacted]', revocationKind: 'admin_revoked' },
        changes: { session: { before: 'active', after: 'revoked' } },
      });

      this.maybeInject('after_audit_staging');
      this.maybeInject('before_commit');
    });

    await this.events
      .publish(new PlatformSessionRevokedEvent(targetUserId, sessionId, 'admin_revoked'))
      .catch(() => undefined);

    this.maybeInject('after_commit_before_response');
    return { ok: true };
  }
}
