import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { PlatformAssuranceService } from '../../auth/application/services/platform-assurance.service';
import { PLATFORM_REFRESH_TOKEN_REPOSITORY } from '../../auth/platform-auth.tokens';
import type { PlatformRefreshTokenRepository } from '../../auth/domain/repositories/platform-refresh-token.repository.interface';
import { EVENT_PUBLISHER, REFRESH_TOKEN_REPOSITORY } from '../../../infrastructure/provider.tokens';
import type { RefreshTokenRepository } from '../../auth/domain/repositories/refresh-token.repository.interface';
import { EffectiveEntitlementRuntimeService } from '../../effective-entitlement-runtime/application/effective-entitlement-runtime.service';
import type { EventPublisherInterface } from '../../../infrastructure/event-publisher.interface';
import { PlatformTenantSuspendedEvent } from '../../platform-admin/domain/events/platform-tenant-suspended.event';
import { PlatformTenantResumedEvent } from '../../platform-admin/domain/events/platform-tenant-resumed.event';
import { PlatformTenantArchivedEvent } from '../../platform-admin/domain/events/platform-tenant-archived.event';
import { PlatformTenantActivatedEvent } from '../../platform-admin/domain/events/platform-tenant-activated.event';
import {
  isTenantLifecycleEnabled,
  TENANT_LIFECYCLE_DISABLED_CODE,
  TENANT_LIFECYCLE_DISABLED_MESSAGE,
} from '../config/tenant-lifecycle-flags';
import {
  LIFECYCLE_OPERATIONS,
  LIFECYCLE_PERMISSIONS,
  REASON_MAX_LEN,
  type LifecycleOperation,
} from '../tenant-lifecycle.constants';
import {
  assertTransition,
  LIFECYCLE_FAILURE_INJECTION_ENV,
  TenantLifecycleError,
  type LifecycleAction,
  type PlatformTenantLifecycleStatus,
} from '../domain/tenant-lifecycle.types';
import { LifecycleIdempotencyService } from './lifecycle-idempotency.service';
import { TenantLifecycleAuditLog } from './tenant-lifecycle-audit.log';
import { TenantLifecyclePreviewService } from './tenant-lifecycle-preview.service';
import { TenantLifecycleRateLimitService } from './tenant-lifecycle-rate-limit.service';
import { resolveOperationCorrelationId } from '../../platform-audit-center/application/operation-correlation';

/** Prisma tx client; `any` avoids Prisma generic mismatch on auditEntry.create. */
type AuditTxClient = any;

type MutationBody = {
  expectedRowVersion: number;
  reason: string;
  previewFingerprint: string;
  typedConfirmation?: string;
  decisionReason?: string;
};

@Injectable()
export class TenantLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: PlatformAuthorizationService,
    private readonly assurance: PlatformAssuranceService,
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly platformSessions: PlatformRefreshTokenRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly clinicSessions: RefreshTokenRepository,
    private readonly eer: EffectiveEntitlementRuntimeService,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
    private readonly idempotency: LifecycleIdempotencyService,
    private readonly audit: TenantLifecycleAuditLog,
    private readonly previewService: TenantLifecyclePreviewService,
    private readonly rateLimit: TenantLifecycleRateLimitService,
  ) {}

  assertMutationsEnabled(): void {
    if (!isTenantLifecycleEnabled()) {
      throw new TenantLifecycleError(
        TENANT_LIFECYCLE_DISABLED_CODE,
        TENANT_LIFECYCLE_DISABLED_MESSAGE,
        503,
      );
    }
  }

  async getLifecycle(claims: JwtClaimsVO, tenantId: string) {
    this.rateLimit.enforce(claims.sub, 'readHeavy');
    await this.authz.assertPermission(claims, LIFECYCLE_PERMISSIONS.view);
    const pt = await this.requirePlatformTenant(tenantId);
    const pending = await this.prisma.withPlatformBypass((c) =>
      c.platformTenantLifecycleRequest.findMany({
        where: { tenantId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    );
    return {
      tenantId: pt.tenantId,
      platformTenantId: pt.id,
      displayName: pt.displayName,
      status: pt.status,
      rowVersion: pt.rowVersion,
      suspendedAt: pt.suspendedAt,
      suspensionReason: pt.suspensionReason,
      archivedAt: pt.archivedAt,
      archivedReason: pt.archivedReason,
      activatedAt: pt.activatedAt,
      pendingRequests: pending.map((r) => ({
        id: r.id,
        type: r.type,
        status: r.status,
        createdAt: r.createdAt,
        requesterPlatformUserId: r.requesterPlatformUserId,
      })),
      lifecycleEnabled: isTenantLifecycleEnabled(),
    };
  }

  async preview(claims: JwtClaimsVO, tenantId: string, action: LifecycleAction) {
    this.rateLimit.enforce(claims.sub, 'readHeavy');
    await this.authz.assertPermission(claims, LIFECYCLE_PERMISSIONS.view);
    return this.previewSvc(tenantId, action);
  }

  private previewSvc(tenantId: string, action: LifecycleAction) {
    return this.previewService.build({ tenantId, action });
  }

  /**
   * Step 21 A12 — durable success AuditEntry append (Model A). Must be
   * called with the same open transaction client as the business lifecycle
   * mutation it documents; throws on failure so the whole transaction
   * rolls back rather than silently losing the audit trail.
   */
  private async auditInTransaction(
    client: AuditTxClient,
    entry: {
      tenantId: string;
      action: string;
      resourceId: string;
      actorId: string;
      descriptionEn: string;
      descriptionAr: string;
      reason?: string | null;
      details?: Record<string, unknown> | null;
    },
  ): Promise<void> {
    const correlationId = resolveOperationCorrelationId({ explicit: null });
    await this.audit.recordInTransaction(client, {
      tenantId: entry.tenantId,
      action: entry.action,
      resourceId: entry.resourceId,
      actorId: entry.actorId,
      actorRoles: ['platform'],
      correlationId,
      reason: entry.reason ?? null,
      descriptionEn: entry.descriptionEn,
      descriptionAr: entry.descriptionAr,
      details: entry.details ?? null,
    });
  }

  async activate(
    claims: JwtClaimsVO,
    tenantId: string,
    body: MutationBody,
    idempotencyKey?: string,
  ) {
    return this.runMutation({
      claims,
      tenantId,
      body,
      idempotencyKey,
      operation: LIFECYCLE_OPERATIONS.ACTIVATE,
      permission: LIFECYCLE_PERMISSIONS.activate,
      action: 'activate',
      execute: async (ctx) => {
        assertTransition(ctx.status, 'activate');
        const openProv = await ctx.tx.platformTenantProvisioningRequest.findFirst({
          where: {
            tenantId,
            status: {
              notIn: [
                'COMPLETED',
                'COMPENSATED',
                'CANCELLED_BEFORE_ACTIVATION',
                'FAILED_TERMINAL',
              ],
            },
          },
        });
        if (openProv) {
          throw new TenantLifecycleError(
            'step17_workflow_incomplete',
            'Cannot activate while a Step 17 provisioning workflow is incomplete.',
            409,
          );
        }
        const now = new Date();
        const updated = await this.bumpStatus(ctx.tx, ctx.pt.id, ctx.body.expectedRowVersion, {
          status: 'ACTIVE',
          activatedAt: now,
        });
        await ctx.tx.tenant.update({
          where: { id: tenantId },
          data: { status: 'ACTIVE', lifecycleStatus: 'ACTIVE' },
        });
        return {
          resourceType: 'platformTenant',
          resourceId: updated.id,
          payload: this.summary(updated),
          postCommit: {
            revokeSessions: false,
            event: new PlatformTenantActivatedEvent(tenantId, ctx.pt.id, claims.sub),
          },
        };
      },
    });
  }

  async suspend(
    claims: JwtClaimsVO,
    tenantId: string,
    body: MutationBody,
    idempotencyKey?: string,
  ) {
    return this.runMutation({
      claims,
      tenantId,
      body,
      idempotencyKey,
      operation: LIFECYCLE_OPERATIONS.SUSPEND,
      permission: LIFECYCLE_PERMISSIONS.suspend,
      action: 'suspend',
      execute: async (ctx) => {
        assertTransition(ctx.status, 'suspend');
        const reason = this.requireReason(body.reason);
        const now = new Date();
        const updated = await this.bumpStatus(ctx.tx, ctx.pt.id, ctx.body.expectedRowVersion, {
          status: 'SUSPENDED',
          suspendedAt: now,
          suspensionReason: reason,
        });
        await ctx.tx.tenant.update({
          where: { id: tenantId },
          data: { status: 'SUSPENDED', lifecycleStatus: 'SUSPENDED' },
        });
        return {
          resourceType: 'platformTenant',
          resourceId: updated.id,
          payload: this.summary(updated),
          postCommit: {
            revokeSessions: true,
            event: new PlatformTenantSuspendedEvent(tenantId, ctx.pt.id, reason, claims.sub),
          },
        };
      },
    });
  }

  async reactivate(
    claims: JwtClaimsVO,
    tenantId: string,
    body: MutationBody,
    idempotencyKey?: string,
  ) {
    return this.runMutation({
      claims,
      tenantId,
      body,
      idempotencyKey,
      operation: LIFECYCLE_OPERATIONS.REACTIVATE,
      permission: LIFECYCLE_PERMISSIONS.resume,
      action: 'reactivate',
      execute: async (ctx) => {
        assertTransition(ctx.status, 'reactivate');
        await this.assertReactivationReadiness(ctx.tx, tenantId);
        // EER readiness is asserted before bumpStatus in runMutation (pre-tx) for reactivate.
        const updated = await this.bumpStatus(ctx.tx, ctx.pt.id, ctx.body.expectedRowVersion, {
          status: 'ACTIVE',
          suspendedAt: null,
          suspensionReason: null,
        });
        await ctx.tx.tenant.update({
          where: { id: tenantId },
          data: { status: 'ACTIVE', lifecycleStatus: 'ACTIVE' },
        });
        return {
          resourceType: 'platformTenant',
          resourceId: updated.id,
          payload: this.summary(updated),
          postCommit: {
            revokeSessions: false,
            event: new PlatformTenantResumedEvent(tenantId, ctx.pt.id, claims.sub),
          },
        };
      },
    });
  }

  async createArchiveRequest(
    claims: JwtClaimsVO,
    tenantId: string,
    body: MutationBody,
    idempotencyKey?: string,
  ) {
    return this.runMutation({
      claims,
      tenantId,
      body,
      idempotencyKey,
      operation: LIFECYCLE_OPERATIONS.ARCHIVE_REQUEST,
      permission: LIFECYCLE_PERMISSIONS.archiveRequest,
      action: 'archive_request',
      execute: async (ctx) => {
        if (ctx.status === 'ARCHIVED') {
          throw new TenantLifecycleError('already_archived', 'Tenant is already archived.', 409);
        }
        const reason = this.requireReason(body.reason);
        const id = randomUUID();
        const row = await ctx.tx.platformTenantLifecycleRequest.create({
          data: {
            id,
            tenantId,
            platformTenantId: ctx.pt.id,
            type: 'ARCHIVE',
            status: 'PENDING',
            reason,
            impactFingerprint: body.previewFingerprint,
            impactSummaryJson: { action: 'archive_request' },
            expectedRowVersionAtCreate: body.expectedRowVersion,
            requesterPlatformUserId: claims.sub,
            correlationId: randomUUID(),
          },
        });
        return { resourceType: 'lifecycleRequest', resourceId: row.id, payload: row };
      },
    });
  }

  async createDeletionRequest(
    claims: JwtClaimsVO,
    tenantId: string,
    body: MutationBody,
    idempotencyKey?: string,
  ) {
    return this.runMutation({
      claims,
      tenantId,
      body,
      idempotencyKey,
      operation: LIFECYCLE_OPERATIONS.DELETION_REQUEST,
      permission: LIFECYCLE_PERMISSIONS.deleteRequest,
      action: 'deletion_request',
      execute: async (ctx) => {
        if (ctx.status !== 'ARCHIVED') {
          throw new TenantLifecycleError(
            'must_be_archived',
            'Deletion request requires an archived tenant.',
            409,
          );
        }
        const reason = this.requireReason(body.reason);
        if (!body.typedConfirmation || body.typedConfirmation !== ctx.pt.displayName) {
          throw new BadRequestException({
            code: 'typed_confirmation_mismatch',
            message: 'Typed confirmation must exactly match the tenant display name.',
          });
        }
        const id = randomUUID();
        const row = await ctx.tx.platformTenantLifecycleRequest.create({
          data: {
            id,
            tenantId,
            platformTenantId: ctx.pt.id,
            type: 'DELETE',
            status: 'PENDING',
            reason,
            impactFingerprint: body.previewFingerprint,
            impactSummaryJson: { action: 'deletion_request', handoffOnly: true },
            expectedRowVersionAtCreate: body.expectedRowVersion,
            typedConfirmation: body.typedConfirmation,
            requesterPlatformUserId: claims.sub,
            correlationId: randomUUID(),
          },
        });
        return { resourceType: 'lifecycleRequest', resourceId: row.id, payload: row };
      },
    });
  }

  async approveRequest(
    claims: JwtClaimsVO,
    requestId: string,
    body: MutationBody,
    idempotencyKey?: string,
  ) {
    this.assertMutationsEnabled();
    this.rateLimit.enforce(claims.sub, 'highImpact');
    await this.authz.assertPermission(claims, LIFECYCLE_PERMISSIONS.approve);
    await this.requireFreshStepUp(claims);
    const key = idempotencyKey ?? `approve-${requestId}-${body.expectedRowVersion}`;
    const hash = this.idempotency.fingerprint({ requestId, ...body });
    const gate = await this.idempotency.beginOrReplay({
      actorId: claims.sub,
      operation: LIFECYCLE_OPERATIONS.APPROVE,
      idempotencyKey: key,
      requestHash: hash,
    });
    if (gate.kind === 'replay') return gate.resultPayload;

    const txResult = await this.prisma.withPlatformBypass(async (tx) => {
        const req = await tx.platformTenantLifecycleRequest.findUnique({ where: { id: requestId } });
        if (!req) throw new NotFoundException('Lifecycle request not found.');
        if (req.status !== 'PENDING') {
          throw new TenantLifecycleError('request_not_pending', 'Request is not pending.', 409);
        }
        if (req.requesterPlatformUserId === claims.sub) {
          throw new ForbiddenException({
            code: 'self_approval_denied',
            message: 'Self-approval is not permitted for lifecycle requests.',
          });
        }
        await this.lockTenant(tx, req.tenantId);
        const stillPending = await tx.platformTenantLifecycleRequest.findUnique({
          where: { id: requestId },
        });
        if (!stillPending || stillPending.status !== 'PENDING') {
          throw new TenantLifecycleError('request_not_pending', 'Request is not pending.', 409);
        }
        const pt = await tx.platformTenant.findUniqueOrThrow({ where: { id: req.platformTenantId } });
        if (pt.rowVersion !== body.expectedRowVersion) {
          throw new ConflictException({ code: 'stale_row_version', message: 'Stale rowVersion.' });
        }

        if (req.type === 'ARCHIVE') {
          const now = new Date();
          await tx.privilegedAccessGrant.updateMany({
            where: { platformTenantId: pt.id, revokedAt: null },
            data: { revokedAt: now, revokedReason: req.reason },
          });
          const updated = await this.bumpStatus(tx, pt.id, body.expectedRowVersion, {
            status: 'ARCHIVED',
            archivedAt: now,
            archivedReason: req.reason,
          });
          await tx.tenant.update({
            where: { id: req.tenantId },
            data: { status: 'ARCHIVED', lifecycleStatus: 'ARCHIVED' },
          });
          const decided = await tx.platformTenantLifecycleRequest.update({
            where: { id: req.id },
            data: {
              status: 'EXECUTED',
              approverPlatformUserId: claims.sub,
              decidedAt: now,
              decisionReason: body.decisionReason ?? null,
            },
          });
          this.maybeInjectFailure('F11');
          await this.idempotency.complete(tx, {
            actorId: claims.sub,
            operation: LIFECYCLE_OPERATIONS.APPROVE,
            idempotencyKey: key,
            requestHash: hash,
            resultResourceType: 'lifecycleRequest',
            resultResourceId: decided.id,
            resultPayload: { request: decided, tenant: this.summary(updated) },
          });
          await this.auditInTransaction(tx, {
            tenantId: req.tenantId,
            action: 'tenant_lifecycle.request.approved',
            resourceId: requestId,
            actorId: claims.sub,
            descriptionEn: 'Lifecycle request approved',
            descriptionAr: 'تمت الموافقة على طلب دورة حياة المستأجر',
            details: { requestId },
          });
          return {
            result: { request: decided, tenant: this.summary(updated) },
            postCommit: {
              tenantId: req.tenantId,
              revokeSessions: true,
              event: new PlatformTenantArchivedEvent(req.tenantId, pt.id, req.reason, claims.sub),
            },
          };
        }

        // DELETE — handoff only
        const decided = await tx.platformTenantLifecycleRequest.update({
          where: { id: req.id },
          data: {
            status: 'APPROVED_HANDOFF',
            approverPlatformUserId: claims.sub,
            decidedAt: new Date(),
            decisionReason: body.decisionReason ?? null,
          },
        });
        this.maybeInjectFailure('F11');
        this.maybeInjectFailure('F26');
        await this.idempotency.complete(tx, {
          actorId: claims.sub,
          operation: LIFECYCLE_OPERATIONS.APPROVE,
          idempotencyKey: key,
          requestHash: hash,
          resultResourceType: 'lifecycleRequest',
          resultResourceId: decided.id,
          resultPayload: { request: decided, physicalDeletion: false },
        });
        await this.auditInTransaction(tx, {
          tenantId: req.tenantId,
          action: 'tenant_lifecycle.request.approved',
          resourceId: requestId,
          actorId: claims.sub,
          descriptionEn: 'Lifecycle request approved',
          descriptionAr: 'تمت الموافقة على طلب دورة حياة المستأجر',
          details: { requestId },
        });
        return {
          result: { request: decided, physicalDeletion: false },
          postCommit: { tenantId: req.tenantId, revokeSessions: false },
        };
    });

    if (txResult.postCommit.revokeSessions) {
      await this.clinicSessions.revokeAllByTenantId(txResult.postCommit.tenantId);
    }
    if (txResult.postCommit.event) {
      await this.events.publish(txResult.postCommit.event);
    }
    await this.eer.invalidateTenant(txResult.postCommit.tenantId);
    return txResult.result;
  }

  async rejectRequest(
    claims: JwtClaimsVO,
    requestId: string,
    body: MutationBody,
    idempotencyKey?: string,
  ) {
    return this.decideSimple(claims, requestId, body, idempotencyKey, 'REJECTED', LIFECYCLE_OPERATIONS.REJECT);
  }

  async cancelRequest(
    claims: JwtClaimsVO,
    requestId: string,
    body: MutationBody,
    idempotencyKey?: string,
  ) {
    return this.decideSimple(claims, requestId, body, idempotencyKey, 'CANCELLED', LIFECYCLE_OPERATIONS.CANCEL);
  }

  async listRequests(claims: JwtClaimsVO, query: { status?: string; take?: number }) {
    this.rateLimit.enforce(claims.sub, 'readHeavy');
    await this.authz.assertPermission(claims, LIFECYCLE_PERMISSIONS.view);
    const take = Math.min(Math.max(query.take ?? 50, 1), 100);
    return this.prisma.withPlatformBypass((c) =>
      c.platformTenantLifecycleRequest.findMany({
        where: query.status
          ? { status: query.status as never }
          : undefined,
        orderBy: { createdAt: 'desc' },
        take,
      }),
    );
  }

  async getRequest(claims: JwtClaimsVO, requestId: string) {
    this.rateLimit.enforce(claims.sub, 'readHeavy');
    await this.authz.assertPermission(claims, LIFECYCLE_PERMISSIONS.view);
    const row = await this.prisma.withPlatformBypass((c) =>
      c.platformTenantLifecycleRequest.findUnique({ where: { id: requestId } }),
    );
    if (!row) throw new NotFoundException('Lifecycle request not found.');
    return row;
  }

  private async decideSimple(
    claims: JwtClaimsVO,
    requestId: string,
    body: MutationBody,
    idempotencyKey: string | undefined,
    status: 'REJECTED' | 'CANCELLED',
    operation: LifecycleOperation,
  ) {
    this.assertMutationsEnabled();
    this.rateLimit.enforce(claims.sub, 'highImpact');
    if (status === 'REJECTED') {
      await this.authz.assertPermission(claims, LIFECYCLE_PERMISSIONS.approve);
    } else {
      // cancel: requester or approver permission
      const perms = await this.authz.resolveEffectivePermissions(claims.sub);
      const req = await this.prisma.withPlatformBypass((c) =>
        c.platformTenantLifecycleRequest.findUnique({ where: { id: requestId } }),
      );
      if (!req) throw new NotFoundException('Lifecycle request not found.');
      const can =
        req.requesterPlatformUserId === claims.sub ||
        perms.includes(LIFECYCLE_PERMISSIONS.approve);
      if (!can) throw new ForbiddenException('Not permitted to cancel this request.');
    }
    await this.requireFreshStepUp(claims);
    const key = idempotencyKey ?? `${status.toLowerCase()}-${requestId}`;
    const hash = this.idempotency.fingerprint({ requestId, status, ...body });
    const gate = await this.idempotency.beginOrReplay({
      actorId: claims.sub,
      operation,
      idempotencyKey: key,
      requestHash: hash,
    });
    if (gate.kind === 'replay') return gate.resultPayload;

    const decided = await this.prisma.withPlatformBypass(async (tx) => {
        const req = await tx.platformTenantLifecycleRequest.findUnique({ where: { id: requestId } });
        if (!req || req.status !== 'PENDING') {
          throw new TenantLifecycleError('request_not_pending', 'Request is not pending.', 409);
        }
        if (status === 'REJECTED' && req.requesterPlatformUserId === claims.sub) {
          throw new ForbiddenException({
            code: 'self_approval_denied',
            message: 'Requester cannot reject their own lifecycle request as an approval substitute.',
          });
        }
        await this.lockTenant(tx, req.tenantId);
        const claimed = await tx.platformTenantLifecycleRequest.updateMany({
          where: { id: requestId, status: 'PENDING' },
          data: {
            status,
            approverPlatformUserId: claims.sub,
            decidedAt: new Date(),
            decisionReason: body.decisionReason ?? body.reason ?? null,
          },
        });
        if (claimed.count !== 1) {
          throw new TenantLifecycleError('request_not_pending', 'Request is not pending.', 409);
        }
        if (status === 'REJECTED') this.maybeInjectFailure('F12');
        if (status === 'CANCELLED') this.maybeInjectFailure('F13');
        const row = await tx.platformTenantLifecycleRequest.findUniqueOrThrow({
          where: { id: requestId },
        });
        await this.idempotency.complete(tx, {
          actorId: claims.sub,
          operation,
          idempotencyKey: key,
          requestHash: hash,
          resultResourceType: 'lifecycleRequest',
          resultResourceId: row.id,
          resultPayload: row,
        });
        await this.auditInTransaction(tx, {
          tenantId: row.tenantId,
          action: `tenant_lifecycle.request.${status.toLowerCase()}`,
          resourceId: requestId,
          actorId: claims.sub,
          descriptionEn: `Lifecycle request ${status.toLowerCase()}`,
          descriptionAr: `طلب دورة حياة المستأجر ${status}`,
          details: { requestId, status },
        });
        return row;
    });
    return decided;
  }

  private async runMutation(input: {
    claims: JwtClaimsVO;
    tenantId: string;
    body: MutationBody;
    idempotencyKey?: string;
    operation: LifecycleOperation;
    permission: string;
    action: LifecycleAction;
    execute: (ctx: {
      tx: Prisma.TransactionClient;
      pt: {
        id: string;
        tenantId: string;
        displayName: string;
        status: string;
        rowVersion: number;
      };
      status: PlatformTenantLifecycleStatus;
      body: MutationBody;
    }) => Promise<{
      resourceType: string;
      resourceId: string;
      payload: unknown;
      postCommit?: {
        revokeSessions?: boolean;
        event?: { eventName: string };
      };
    }>;
  }) {
    this.assertMutationsEnabled();
    this.maybeInjectFailure('F01');
    this.rateLimit.enforce(input.claims.sub, 'highImpact');
    await this.authz.assertPermission(input.claims, input.permission);
    await this.requireFreshStepUp(input.claims);
    this.requireReason(input.body.reason);
    if (
      typeof input.body.expectedRowVersion !== 'number' ||
      !Number.isInteger(input.body.expectedRowVersion)
    ) {
      throw new BadRequestException({
        code: 'expected_row_version_required',
        message: 'expectedRowVersion is required.',
      });
    }
    if (!input.body.previewFingerprint?.trim()) {
      throw new BadRequestException({
        code: 'preview_fingerprint_required',
        message: 'previewFingerprint is required.',
      });
    }

    const key =
      input.idempotencyKey ??
      `${input.operation}-${input.tenantId}-${input.body.expectedRowVersion}`;
    const hash = this.idempotency.fingerprint({
      tenantId: input.tenantId,
      action: input.action,
      ...input.body,
    });
    const gate = await this.idempotency.beginOrReplay({
      actorId: input.claims.sub,
      operation: input.operation,
      idempotencyKey: key,
      requestHash: hash,
    });
    this.maybeInjectFailure('F02');
    if (gate.kind === 'replay') return gate.resultPayload;

    const livePreview = await this.previewSvc(input.tenantId, input.action);
    if (livePreview.previewFingerprint !== input.body.previewFingerprint) {
      throw new ConflictException({
        code: 'preview_stale',
        message: 'Impact preview fingerprint is stale.',
      });
    }
    if (livePreview.blockers.length > 0) {
      throw new ConflictException({
        code: 'lifecycle_blockers',
        message: 'Lifecycle action is blocked.',
        blockers: livePreview.blockers,
      });
    }
    this.maybeInjectFailure('F03');

    // Reactivation invariant: EER readiness before ACTIVE write
    if (input.action === 'reactivate') {
      await this.assertEerReadyBeforeReactivation(input.tenantId);
      this.maybeInjectFailure('F08');
    }

    let postCommit: {
      revokeSessions?: boolean;
      event?: { eventName: string };
    } = {};

    const result = await this.prisma.withPlatformBypass(async (tx) => {
        await this.lockTenant(tx, input.tenantId);
        this.maybeInjectFailure('F04');
        const pt = await tx.platformTenant.findUnique({ where: { tenantId: input.tenantId } });
        if (!pt) throw new NotFoundException('Platform tenant not found.');
        if (pt.rowVersion !== input.body.expectedRowVersion) {
          throw new ConflictException({ code: 'stale_row_version', message: 'Stale rowVersion.' });
        }
        const executed = await input.execute({
          tx,
          pt,
          status: pt.status as PlatformTenantLifecycleStatus,
          body: input.body,
        });
        this.maybeInjectFailure('F05');
        // F06 — Step 16 application-service integration staging (read-only commercial probe; no table writes)
        this.maybeInjectFailure('F06');
        if (input.action === 'archive_request') this.maybeInjectFailure('F09');
        if (input.action === 'deletion_request') this.maybeInjectFailure('F10');
        postCommit = executed.postCommit ?? {};
        if (postCommit.revokeSessions) this.maybeInjectFailure('F07');
        this.maybeInjectFailure('F14');
        // F20 — background-job policy adapter staging (suspend/archive deny-by-license; no job discard)
        if (input.action === 'suspend' || input.action === 'archive_request') {
          this.maybeInjectFailure('F20');
        }
        await this.idempotency.complete(tx, {
          actorId: input.claims.sub,
          operation: input.operation,
          idempotencyKey: key,
          requestHash: hash,
          resultResourceType: executed.resourceType,
          resultResourceId: executed.resourceId,
          resultPayload: executed.payload,
        });
        this.maybeInjectFailure('F16');
        this.maybeInjectFailure('F17');
        // Step 21 A12 — durable success audit commits atomically with the
        // business mutation and idempotency completion (Model A); F15 now
        // guards this in-transaction staging rather than a post-commit gap.
        await this.auditInTransaction(tx, {
          tenantId: input.tenantId,
          action: `tenant_lifecycle.${input.action}`,
          resourceId: input.tenantId,
          actorId: input.claims.sub,
          descriptionEn: `Tenant lifecycle ${input.action}`,
          descriptionAr: `إجراء دورة حياة المستأجر ${input.action}`,
          reason: input.body.reason,
          details: {
            action: input.action,
            fingerprint: createHash('sha256')
              .update(input.body.previewFingerprint)
              .digest('hex')
              .slice(0, 16),
          },
        });
        this.maybeInjectFailure('F15');
        return executed.payload;
    });

    this.maybeInjectFailure('F18');
    // Post-commit: session revoke + outbox must not roll back committed lifecycle state
    if (postCommit.revokeSessions) {
      try {
        this.maybeInjectFailure('F22');
        await this.clinicSessions.revokeAllByTenantId(input.tenantId);
      } catch (err) {
        // Compensation/recovery staging after revocation failure (status already committed)
        this.maybeInjectFailure('F27');
        // Fail-closed access via PlatformTenant.status; retry revocation without rolling back status
        if (err instanceof TenantLifecycleError && err.code === 'injected_failure') {
          throw err;
        }
        throw new TenantLifecycleError(
          'session_revocation_failed',
          'Session revocation failed after lifecycle commit; access remains denied by status.',
          500,
        );
      }
    }
    if (postCommit.event) {
      try {
        this.maybeInjectFailure('F21');
        await this.events.publish(postCommit.event as never);
      } catch (err) {
        if (err instanceof TenantLifecycleError && err.code === 'injected_failure') {
          throw err;
        }
        // Delivery is retryable via outbox; lifecycle state already committed
      }
    }
    try {
      this.maybeInjectFailure('F08');
      this.maybeInjectFailure('F23');
      await this.eer.invalidateTenant(input.tenantId);
    } catch (err) {
      if (err instanceof TenantLifecycleError && err.code === 'injected_failure') {
        throw err;
      }
      // Access paths re-read PostgreSQL; stale cache cannot grant write after SUSPENDED commit
    }
    return result;
  }

  private async assertReactivationReadiness(
    tx: Prisma.TransactionClient,
    tenantId: string,
  ): Promise<void> {
    const pending = await tx.platformTenantLifecycleRequest.findFirst({
      where: {
        tenantId,
        status: 'PENDING',
        type: { in: ['ARCHIVE', 'DELETE'] },
      },
    });
    if (pending) {
      throw new TenantLifecycleError(
        'lifecycle_request_blocks_reactivation',
        'Cannot reactivate while an archive or deletion request is pending.',
        409,
      );
    }
    const openProv = await tx.platformTenantProvisioningRequest.findFirst({
      where: {
        tenantId,
        status: {
          notIn: ['COMPLETED', 'COMPENSATED', 'CANCELLED_BEFORE_ACTIVATION', 'FAILED_TERMINAL'],
        },
      },
    });
    if (openProv) {
      throw new TenantLifecycleError(
        'step17_workflow_incomplete',
        'Cannot reactivate while a Step 17 provisioning workflow is incomplete.',
        409,
      );
    }
    const pt = await tx.platformTenant.findUnique({ where: { tenantId } });
    if (!pt) {
      throw new TenantLifecycleError('tenant_not_found', 'Platform tenant not found.', 404);
    }
    const completedProv = await tx.platformTenantProvisioningRequest.findFirst({
      where: { tenantId, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
    });
    if (completedProv) {
      const commercial = await tx.platformSubscriptionCommercialConfig.findFirst({
        where: { platformTenantId: pt.id, isCurrent: true },
      });
      if (
        commercial &&
        (commercial.lifecycle === 'CANCELLED' ||
          commercial.lifecycle === 'EXPIRED' ||
          commercial.lifecycle === 'SUPERSEDED')
      ) {
        throw new TenantLifecycleError(
          'commercial_ineligible',
          'Commercial configuration is not eligible for reactivation.',
          409,
        );
      }
      this.maybeInjectFailure('F25');
      if (commercial) {
        const snap = await tx.platformSubscriptionCommercialSnapshot.findFirst({
          where: { configId: commercial.id },
        });
        if (!snap) {
          throw new TenantLifecycleError(
            'activation_snapshot_missing',
            'Immutable activation snapshot is required before reactivation.',
            409,
          );
        }
      }
    }
  }

  /**
   * Pre-ACTIVE EER readiness (outside the status-write transaction).
   * Fail closed: managed tenants must not resolve as Legacy; missing/malformed authority blocks reactivation.
   */
  private async assertEerReadyBeforeReactivation(tenantId: string): Promise<void> {
    this.maybeInjectFailure('F24');
    await this.eer.invalidateTenant(tenantId);
    try {
      const bundle = await this.eer.resolveEffectiveEntitlements(tenantId);
      if (!bundle) {
        throw new TenantLifecycleError(
          'eer_readiness_failed',
          'Effective entitlement runtime did not return a bundle.',
          409,
        );
      }
      if ((bundle as { source?: string }).source === 'LEGACY') {
        const pt = await this.prisma.withPlatformBypass((c) =>
          c.platformTenant.findUnique({ where: { tenantId } }),
        );
        const commercial = pt
          ? await this.prisma.withPlatformBypass((c) =>
              c.platformSubscriptionCommercialConfig.findFirst({
                where: { platformTenantId: pt.id, isCurrent: true },
              }),
            )
          : null;
        if (commercial) {
          throw new TenantLifecycleError(
            'eer_legacy_forbidden',
            'Managed tenant cannot reactivate via Legacy entitlement authority.',
            409,
          );
        }
      }
    } catch (err) {
      if (err instanceof TenantLifecycleError) throw err;
      throw new TenantLifecycleError(
        'eer_readiness_failed',
        'Effective entitlement readiness check failed before reactivation.',
        409,
      );
    }
  }

  private maybeInjectFailure(point: string): void {
    if (process.env.NODE_ENV === 'production') return;
    if (process.env[LIFECYCLE_FAILURE_INJECTION_ENV] === point) {
      throw new TenantLifecycleError('injected_failure', `Injected failure at ${point}`, 500);
    }
  }

  private async bumpStatus(
    tx: Prisma.TransactionClient,
    platformTenantId: string,
    expectedRowVersion: number,
    data: Prisma.PlatformTenantUpdateManyMutationInput,
  ) {
    const res = await tx.platformTenant.updateMany({
      where: { id: platformTenantId, rowVersion: expectedRowVersion },
      data: { ...data, rowVersion: { increment: 1 } },
    });
    if (res.count !== 1) {
      throw new ConflictException({ code: 'stale_row_version', message: 'Stale rowVersion.' });
    }
    return tx.platformTenant.findUniqueOrThrow({ where: { id: platformTenantId } });
  }

  private async lockTenant(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
    const buf = createHash('sha256').update(`tenant-lifecycle:${tenantId}`).digest();
    const key = buf.readInt32BE(0);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key})`;
  }

  private async requirePlatformTenant(tenantId: string) {
    const pt = await this.prisma.withPlatformBypass((c) =>
      c.platformTenant.findUnique({ where: { tenantId } }),
    );
    if (!pt) throw new NotFoundException('Platform tenant not found.');
    return pt;
  }

  private requireReason(reason: string): string {
    const r = reason?.trim() ?? '';
    if (r.length < 3 || r.length > REASON_MAX_LEN) {
      throw new BadRequestException({
        code: 'reason_required',
        message: `Reason must be 3–${REASON_MAX_LEN} characters.`,
      });
    }
    return r;
  }

  private summary(pt: {
    id: string;
    tenantId: string;
    displayName: string;
    status: string;
    rowVersion: number;
  }) {
    return {
      platformTenantId: pt.id,
      tenantId: pt.tenantId,
      displayName: pt.displayName,
      status: pt.status,
      rowVersion: pt.rowVersion,
    };
  }

  private async requireFreshStepUp(claims: JwtClaimsVO): Promise<void> {
    if (!claims.sessionId) throw new ForbiddenException('Fresh step-up required.');
    const session = await this.platformSessions.findBySessionId(claims.sessionId);
    if (!session) throw new ForbiddenException('Fresh step-up required.');
    this.assurance.requireStepUp(session);
  }
}
