import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { resolveOperationCorrelationId } from '../../platform-audit-center/application/operation-correlation';
import { TrialAdminService } from './trial-admin.service';
import { TrialAuditLog } from './trial-audit.log';
import { TrialProvisioningAdapter } from './trial-provisioning.adapter';
import {
  TrialDurableIdempotencyService,
  TrialIdempotencyEquivalentRaceLostError,
} from './trial-durable-idempotency.service';
import { resolvePublishedPlanVersion } from './trial-catalog-validation';
import {
  SALES_TRIAL_AUDIT_ACTIONS,
  SALES_TRIAL_AUDIT_RESOURCE_TYPE,
  SALES_TRIAL_OPERATIONS,
  SALES_TRIAL_PERMISSIONS,
  TRIAL_CONVERSION_OUTBOX_AGGREGATE_TYPE,
  TRIAL_CONVERSION_OUTBOX_EVENT_TYPE,
  isSalesTrialsFailureInjectionActive,
} from '../platform-sales-trials.constants';
import {
  SalesTrialConflictError,
  SalesTrialError,
  SalesTrialForbiddenError,
  SalesTrialValidationError,
} from '../domain/sales-trial.errors';
import {
  TRIAL_GRANT_DISPOSITIONS,
  type SalesTrialConversionDto,
  type TrialAttributionSnapshot,
  type TrialGrantDisposition,
  type TrialGrantDispositionInput,
  type TrialOnlyGrant,
} from '../domain/sales-trial.types';

export type TrialConversionResult = {
  trialId: string;
  status: 'CONVERTED';
  conversion: SalesTrialConversionDto;
  replayed: boolean;
};

/**
 * Flexible Step 25 — Trial → paid customer conversion.
 *
 * Governance transition, durable conversion record, and outbox event are committed in one
 * transaction after the Step 16 commercial path has been migrated to the target published
 * paid Plan Version. Attribution is never rewritten.
 */
@Injectable()
export class TrialConversionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: TrialAdminService,
    private readonly durable: TrialDurableIdempotencyService,
    private readonly audit: TrialAuditLog,
    private readonly provisioning: TrialProvisioningAdapter,
  ) {}

  /** Audit actor roles are mandatory; platform tokens may carry no role claim. */
  private actorRoles(claims: JwtClaimsVO): string[] {
    const roles = (claims.roles as unknown as string[]) ?? [];
    return roles.length > 0 ? roles : ['platform'];
  }

  async convert(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    trialId: string,
    input: {
      targetPaidPlanVersionId: string;
      dispositions?: TrialGrantDispositionInput[];
      expectedRowVersion: number;
      reason?: string;
    },
    idempotencyKey: string,
  ): Promise<TrialConversionResult> {
    if (!perms.has(SALES_TRIAL_PERMISSIONS.convert)) {
      throw new SalesTrialForbiddenError(`Missing ${SALES_TRIAL_PERMISSIONS.convert}`);
    }
    const trial = await this.admin.getById(claims, perms, trialId);

    // PV/C gate — only an ACTIVE Trial converts; EXPIRED is not convertible by default.
    // CONVERTED short-circuit still enforces durable same-key / different-payload conflict (I09).
    if (trial.status === 'CONVERTED') {
      const existing = await this.admin.getConversion(claims, perms, trialId);
      if (existing) {
        const priorHash = await this.durable.findRequestHash({
          actorId: claims.sub,
          operation: SALES_TRIAL_OPERATIONS.convert,
          idempotencyKey,
        });
        if (priorHash) {
          const target = await resolvePublishedPlanVersion(
            this.prisma,
            input.targetPaidPlanVersionId,
            'conversion',
          );
          const dispositions = this.resolveDispositions(
            trial.trialOnlyGrants ?? [],
            input.dispositions ?? [],
          );
          const requestHash = this.durable.fingerprint({
            op: SALES_TRIAL_OPERATIONS.convert,
            trialId,
            targetPaidPlanVersionId: target.id,
            dispositions,
            expectedRowVersion: input.expectedRowVersion,
          });
          if (priorHash !== requestHash) {
            throw new SalesTrialError(
              'idempotency_conflict',
              'Idempotency-Key conflicts with a prior claim',
              409,
            );
          }
        }
        return { trialId, status: 'CONVERTED', conversion: existing, replayed: true };
      }
    }
    if (trial.status !== 'ACTIVE') {
      throw new SalesTrialConflictError(
        `Trials in status ${trial.status} cannot be converted.`,
        'trial_status_not_convertible',
      );
    }
    if (this.admin.isRuntimeExpired({ expiresAt: trial.expiresAt ? new Date(trial.expiresAt) : null })) {
      throw new SalesTrialConflictError(
        'Trial window has elapsed; expiry must be processed before conversion.',
        'trial_window_elapsed',
      );
    }
    if (trial.rowVersion !== input.expectedRowVersion) {
      throw new SalesTrialConflictError('Row version conflict.', 'row_version_conflict');
    }
    if (!trial.platformTenantId) {
      throw new SalesTrialConflictError(
        'Trial has no provisioned tenant to convert.',
        'trial_tenant_missing',
      );
    }

    const target = await resolvePublishedPlanVersion(
      this.prisma,
      input.targetPaidPlanVersionId,
      'conversion',
    );
    const dispositions = this.resolveDispositions(trial.trialOnlyGrants ?? [], input.dispositions ?? []);

    const operation = SALES_TRIAL_OPERATIONS.convert;
    const requestHash = this.durable.fingerprint({
      op: operation,
      trialId,
      targetPaidPlanVersionId: target.id,
      dispositions,
      expectedRowVersion: input.expectedRowVersion,
    });
    const gate = await this.durable.claimOrReplay({
      actorId: claims.sub,
      operation,
      idempotencyKey,
      requestHash,
      resultResourceType: 'platformSalesTrial',
      resultResourceId: trialId,
    });
    if (gate.kind === 'replay') {
      const existing = await this.admin.getConversion(claims, perms, trialId);
      if (!existing) {
        throw new SalesTrialConflictError(
          'Durable conversion claim exists without a conversion record.',
          'conversion_record_missing',
        );
      }
      return { trialId, status: 'CONVERTED', conversion: existing, replayed: true };
    }

    try {
      // Step 16 commercial migration first: the paid snapshot must exist before the
      // governance aggregate claims CONVERTED.
      const commercialConfigId = await this.provisioning.migrateCommercialToPaid({
        claims,
        trialId,
        platformTenantId: trial.platformTenantId,
        targetPlanVersionId: target.id,
        reason: (input.reason ?? 'Sales trial conversion').slice(0, 500),
      });

      const convertedAt = this.admin.now();
      const outboxEventId = randomUUID();
      const attribution = trial.attributionSnapshot as TrialAttributionSnapshot | null;

      await this.prisma.withPlatformBypass(async (client) => {
        const claimed = await client.platformSalesTrial.updateMany({
          where: { id: trialId, status: 'ACTIVE', rowVersion: input.expectedRowVersion },
          data: {
            status: 'CONVERTED',
            commercialConfigId,
            trialOnlyGrantsJson: this.applyDispositionsToGrants(
              trial.trialOnlyGrants ?? [],
              dispositions,
              convertedAt,
            ) as unknown as Prisma.InputJsonValue,
            rowVersion: { increment: 1 },
          },
        });
        if (claimed.count !== 1) {
          throw new SalesTrialConflictError('Row version conflict.', 'row_version_conflict');
        }
        const correlationId = resolveOperationCorrelationId({});

        await client.platformSalesTrialConversion.create({
          data: {
            trialId,
            targetPaidPlanVersionId: target.id,
            dispositionsJson: dispositions as unknown as Prisma.InputJsonValue,
            actorPlatformUserId: claims.sub,
            convertedAt,
            correlationId,
            outboxEventId,
            commercialConfigId,
          },
        });

        if (isSalesTrialsFailureInjectionActive('conversion_outbox_write')) {
          throw new SalesTrialValidationError('Injected conversion outbox write', 'injected_failure');
        }
        // Outbox is written in the same transaction as the durable conversion.
        // Payload carries governance identifiers only — no PHI, secrets, or amounts.
        await client.outboxEvent.create({
          data: {
            id: outboxEventId,
            eventType: TRIAL_CONVERSION_OUTBOX_EVENT_TYPE,
            aggregateType: TRIAL_CONVERSION_OUTBOX_AGGREGATE_TYPE,
            aggregateId: trialId,
            payload: {
              trialId,
              platformTenantId: trial.platformTenantId,
              targetPaidPlanVersionId: target.id,
              targetPlanCanonicalKey: target.planCanonicalKey,
              commercialConfigId,
              convertedAt: convertedAt.toISOString(),
              correlationId,
              originatingLeadId: attribution?.originatingLeadId ?? trial.originatingLeadId ?? null,
              ownerRepresentativeId:
                attribution?.ownerRepresentativeId ?? trial.ownerRepresentativeId ?? null,
              dispositions,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        await this.durable.completeInTransaction(client, {
          actorId: claims.sub,
          operation,
          idempotencyKey,
          requestHash,
          resultResourceType: 'platformSalesTrial',
          resultResourceId: trialId,
          result: {
            accepted: true,
            replayed: false,
            action: operation,
            targetId: trialId,
            correlationId,
            result: 'accepted',
          },
        });

        await this.audit.recordInTransaction(client, {
          action: SALES_TRIAL_AUDIT_ACTIONS.CONVERTED,
          resourceType: SALES_TRIAL_AUDIT_RESOURCE_TYPE,
          resourceId: trialId,
          actorId: claims.sub,
          actorRoles: this.actorRoles(claims),
          reason: input.reason ?? null,
          correlationId,
          details: {
            targetPaidPlanVersionId: target.id,
            targetPlanCanonicalKey: target.planCanonicalKey,
            commercialConfigId,
            dispositions,
            attributionRetained: true,
            outboxEventId,
            entitlementAuthority: 'step16_snapshot_step18_eer',
          },
          result: 'success',
          descriptionEn: 'Sales trial converted to paid customer',
          descriptionAr: 'تم تحويل النسخة التجريبية إلى عميل مدفوع',
        });
      });

      // Step 19 lifecycle handoff to paid ACTIVE + Step 18 EER invalidation.
      await this.provisioning.activateTenantForPaid({ platformTenantId: trial.platformTenantId });
    } catch (err) {
      if (err instanceof TrialIdempotencyEquivalentRaceLostError) {
        const existing = await this.admin.getConversion(claims, perms, trialId);
        if (existing) {
          return { trialId, status: 'CONVERTED', conversion: existing, replayed: true };
        }
      }
      await this.durable.releasePendingClaim({ actorId: claims.sub, operation, idempotencyKey });
      throw err;
    }

    if (isSalesTrialsFailureInjectionActive('after_conversion_commit_before_response')) {
      throw new SalesTrialValidationError(
        'Injected after conversion commit before response',
        'injected_failure',
      );
    }

    const conversion = await this.admin.getConversion(claims, perms, trialId);
    if (!conversion) {
      throw new SalesTrialConflictError(
        'Conversion record missing after commit.',
        'conversion_record_missing',
      );
    }
    return { trialId, status: 'CONVERTED', conversion, replayed: false };
  }

  /**
   * Every trial-only grant needs an explicit disposition; ambiguous or unknown input
   * fails the conversion safely instead of silently carrying grants forward.
   */
  private resolveDispositions(
    grants: TrialOnlyGrant[],
    provided: TrialGrantDispositionInput[],
  ): TrialGrantDispositionInput[] {
    if (isSalesTrialsFailureInjectionActive('conversion_disposition_validation')) {
      throw new SalesTrialValidationError(
        'Injected conversion disposition validation',
        'injected_failure',
      );
    }
    const seen = new Map<string, TrialGrantDispositionInput>();
    for (const entry of provided) {
      const grantKey = (entry?.grantKey ?? '').trim();
      if (!grantKey) {
        throw new SalesTrialValidationError(
          'Each disposition requires grantKey.',
          'disposition_grant_key_required',
        );
      }
      if (!TRIAL_GRANT_DISPOSITIONS.includes(entry.disposition as TrialGrantDisposition)) {
        throw new SalesTrialValidationError(
          `Unknown disposition ${String(entry.disposition)} for ${grantKey}.`,
          'disposition_unknown',
        );
      }
      if (seen.has(grantKey)) {
        const prior = seen.get(grantKey)!;
        if (prior.disposition !== entry.disposition) {
          throw new SalesTrialValidationError(
            `Ambiguous dispositions supplied for ${grantKey}.`,
            'disposition_ambiguous',
          );
        }
        continue;
      }
      if (
        entry.disposition === 'MIGRATE_TO_PAID_EQUIVALENT' &&
        !(entry.paidEquivalentKey ?? '').trim()
      ) {
        throw new SalesTrialValidationError(
          `MIGRATE_TO_PAID_EQUIVALENT requires paidEquivalentKey for ${grantKey}.`,
          'disposition_paid_equivalent_required',
        );
      }
      seen.set(grantKey, {
        grantKey,
        disposition: entry.disposition,
        paidEquivalentKey: entry.paidEquivalentKey?.trim() ?? null,
        note: entry.note?.slice(0, 500) ?? null,
      });
    }

    const required = grants.filter((g) => g.trialOnly).map((g) => g.grantKey);
    const missing = required.filter((key) => !seen.has(key));
    if (missing.length > 0) {
      throw new SalesTrialValidationError(
        `Missing dispositions for trial-only grants: ${missing.join(', ')}.`,
        'disposition_required',
      );
    }
    const known = new Set(grants.map((g) => g.grantKey));
    const unknown = [...seen.keys()].filter((key) => !known.has(key));
    if (unknown.length > 0) {
      throw new SalesTrialValidationError(
        `Dispositions reference unknown grants: ${unknown.join(', ')}.`,
        'disposition_unknown_grant',
      );
    }
    return [...seen.values()].sort((a, b) => a.grantKey.localeCompare(b.grantKey));
  }

  private applyDispositionsToGrants(
    grants: TrialOnlyGrant[],
    dispositions: TrialGrantDispositionInput[],
    convertedAt: Date,
  ): Array<Record<string, unknown>> {
    const byKey = new Map(dispositions.map((d) => [d.grantKey, d]));
    return grants.map((g) => {
      const d = byKey.get(g.grantKey);
      const expiresOnConversion =
        d?.disposition === 'EXPIRE_ON_CONVERSION' || d?.disposition === 'EXPIRE_ON_TRIAL_EXPIRY';
      return {
        ...g,
        disposition: d?.disposition ?? 'RETAIN_NOT_TRIAL_ONLY',
        paidEquivalentKey: d?.paidEquivalentKey ?? null,
        expiredAt: expiresOnConversion ? convertedAt.toISOString() : null,
      };
    });
  }
}
