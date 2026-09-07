import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CommissionAccrualStatus,
  CommissionCalculationBasis,
  CommissionEarningTrigger,
  Prisma,
  ServicePerformanceParticipantRole,
  ServicePerformanceStatus,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { assertUuid } from '../../dental/services/wave-d-reference.validation';
import { WAVE_F_AUDIT_LOG, WaveFAuditLog } from '../ports/wave-f-audit-log.port';
import { roundMoney, splitByShares } from './money-rounding';
import {
  assertRealizableRefundEffectSet,
  assertReversalSignedEconomicShape,
} from './refund-complete-set';
import { StaffCommissionPlanService, WaveFActor } from './staff-commission-plan.service';
import { assertTwoWayInvoiceLinePerformanceProvenance } from './invoice-line-performance-provenance';

function canSelfEdit(roles: string[]): boolean {
  const normalized = (roles ?? []).map((r) => String(r).trim().toLowerCase());
  return normalized.includes('owner') || normalized.includes('super_admin');
}

function assertNotSelfEdit(actorId: string, actorRoles: string[], targetUserId: string) {
  if (actorId === targetUserId && !canSelfEdit(actorRoles)) {
    throw new ForbiddenException(
      'Self-edit of staff commission is denied unless actor has owner or super_admin role',
    );
  }
}

function isUniqueConflict(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/**
 * Wave F Round 11/12 — only refund-semantic unique conflicts from commissionAccrual.create
 * may be recovered. Empty/missing targets are NOT recoverable (audit/downstream P2002 must abort).
 */
export function isRecoverableCommissionRefundUniqueConflict(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {
    return false;
  }
  const target = err.meta?.target;
  if (target == null) return false;
  const fields = Array.isArray(target)
    ? target.map((t) => String(t).toLowerCase())
    : [String(target).toLowerCase()];
  if (fields.length === 0) return false;
  const joined = fields.join(',');
  if (!joined.trim()) return false;
  if (joined.includes('idempotencykey')) return true;
  if (joined.includes('commission_accruals_tenant_root_refund_uidx')) return true;
  if (joined.includes('refundid') && joined.includes('reversalofaccrualid')) return true;
  return false;
}

/** Canonical R10/R11 refund idempotency key. */
export function canonicalRootRefundIdempotencyKey(rootId: string, refundId: string): string {
  return `rev:${rootId}:${refundId}`;
}

/**
 * Round 9 historical carry keys: rev_corr_refund:{rootId}:{refundId}:{correctionEventId}
 * Accepted only after full Round 11 status/sign/provenance/amount validation.
 */
export function isPermittedRootRefundIdempotencyKey(
  key: string,
  rootId: string,
  refundId: string,
): boolean {
  const trimmed = String(key ?? '').trim();
  if (trimmed === canonicalRootRefundIdempotencyKey(rootId, refundId)) return true;
  const legacy = new RegExp(
    `^rev_corr_refund:${rootId}:${refundId}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`,
    'i',
  );
  return legacy.test(trimmed);
}

async function withSavepoint<T>(
  tx: Prisma.TransactionClient,
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const sp = name.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 60);
  await tx.$executeRawUnsafe(`SAVEPOINT ${sp}`);
  try {
    const result = await fn();
    await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${sp}`);
    return result;
  } catch (err) {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${sp}`);
    throw err;
  }
}

/**
 * Frozen AR-21: commission attribution must never use Appointment.providerId.
 * Exported for Wave F tests.
 */
export function assertNoAppointmentProviderBlindAttribution(opts?: {
  appointmentProviderId?: string | null;
  attributionSource?: string | null;
}): { ok: true; rule: string } {
  if (opts?.appointmentProviderId) {
    throw new BadRequestException(
      'Appointment.providerId must never auto-attribute commission; use ServicePerformanceParticipant only',
    );
  }
  if (
    opts?.attributionSource &&
    String(opts.attributionSource).toLowerCase().includes('appointment.provider')
  ) {
    throw new BadRequestException(
      'Blind Appointment.providerId commission attribution is forbidden',
    );
  }
  return {
    ok: true,
    rule: 'ServicePerformanceParticipant only; Appointment.providerId never attributes commission',
  };
}

type LinkagePerformance = {
  id: string;
  patientId: string | null;
  branchId: string | null;
  appointmentId: string | null;
  encounterId: string | null;
  clinicalServiceId: string;
  snapshotRevisionId: string | null;
};

type LinkageLine = {
  id: string;
  encounterId: string | null;
  serviceCode: string | null;
  servicePerformanceId: string | null;
  appointmentId?: string | null;
  clinicalServiceId?: string | null;
  snapshotRevisionId?: string | null;
  courseSessionId?: string | null;
  performanceBindingStatus?: string | null;
};

type LinkageInvoice = {
  patientId: string;
  branchId: string | null;
};

/** Authoritative billing statuses that mean charge/invoice is finalized for SERVICE_* earn. */
const FINALIZED_INVOICE_STATUSES = new Set([
  'ISSUED',
  'PARTIAL_PAID',
  'PAID',
  'OVERDUE',
]);

export function assertInvoiceChargeFinalized(status: string): void {
  if (!FINALIZED_INVOICE_STATUSES.has(status)) {
    throw new BadRequestException(
      `Invoice/charge is not finalized for commission earning (status=${status}); require ISSUED|PARTIAL_PAID|PAID|OVERDUE`,
    );
  }
}

/**
 * Round 2 F3 — authoritative durable ServicePerformance ↔ InvoiceLine attribution.
 * Requires invoice_line_items.servicePerformanceId === performance.id.
 * serviceCode alone is never sufficient. Same patient/service/different encounter fails closed.
 */
export async function assertPerformanceInvoiceLineLinkage(
  tx: Prisma.TransactionClient,
  tenantId: string,
  performance: LinkagePerformance,
  line: LinkageLine,
  invoice: LinkageInvoice,
): Promise<void> {
  if (!line.servicePerformanceId) {
    throw new BadRequestException(
      'Invoice line must carry durable servicePerformanceId linking to the performed event',
    );
  }
  if (line.servicePerformanceId !== performance.id) {
    throw new BadRequestException(
      'Invoice line servicePerformanceId must equal the ServicePerformance being accrued',
    );
  }
  if (line.performanceBindingStatus && line.performanceBindingStatus !== 'ACTIVE') {
    throw new BadRequestException(
      'Invoice line ServicePerformance binding is not ACTIVE (superseded/stale source cannot earn)',
    );
  }

  // Round 4/6 accrual linkage: when LINE carries provenance, performance must prove and match.
  // Full two-way (performance→line) is enforced by bind-performance + correction via
  // assertTwoWayInvoiceLinePerformanceProvenance (requireDurableContext=true).
  if (line.appointmentId != null) {
    if (performance.appointmentId == null) {
      throw new BadRequestException(
        'ServicePerformance lacks appointmentId required to match invoice line provenance',
      );
    }
    if (line.appointmentId !== performance.appointmentId) {
      throw new BadRequestException('Invoice line appointmentId must match ServicePerformance.appointmentId');
    }
  }
  if (line.clinicalServiceId != null) {
    if (line.clinicalServiceId !== performance.clinicalServiceId) {
      throw new BadRequestException('Invoice line clinicalServiceId must match ServicePerformance.clinicalServiceId');
    }
  }
  if (line.snapshotRevisionId != null) {
    if (performance.snapshotRevisionId == null) {
      throw new BadRequestException(
        'ServicePerformance lacks snapshotRevisionId required to match invoice line provenance',
      );
    }
    if (line.snapshotRevisionId !== performance.snapshotRevisionId) {
      throw new BadRequestException('Invoice line snapshotRevisionId must match ServicePerformance.snapshotRevisionId');
    }
  }
  if (line.encounterId != null && performance.encounterId != null && line.encounterId !== performance.encounterId) {
    throw new BadRequestException(
      'Invoice line encounterId must match ServicePerformance.encounterId when both are set',
    );
  }
  if (line.courseSessionId != null) {
    await assertTwoWayInvoiceLinePerformanceProvenance(tx, tenantId, line, performance, invoice, {
      requireDurableContext: false,
    });
  }

  if (performance.patientId != null && performance.patientId !== invoice.patientId) {
    throw new BadRequestException(
      'Performance patientId must match invoice.patientId for commission accrual',
    );
  }
  if (
    performance.branchId != null &&
    invoice.branchId != null &&
    performance.branchId !== invoice.branchId
  ) {
    throw new BadRequestException(
      'Performance branchId must match invoice.branchId when both are set',
    );
  }

  // Appointment context enrichment checks (patient/service agreement on appointment row).
  if (performance.appointmentId != null) {
    const appt = await tx.appointment.findFirst({
      where: { id: performance.appointmentId, tenantId },
      select: { id: true, patientId: true, branchId: true, clinicalServiceId: true },
    });
    if (!appt) {
      throw new BadRequestException('ServicePerformance appointment context not found');
    }
    if (appt.patientId !== invoice.patientId) {
      throw new BadRequestException('Appointment patient must match invoice patient');
    }
    if (performance.clinicalServiceId !== appt.clinicalServiceId && appt.clinicalServiceId != null) {
      throw new BadRequestException(
        'ServicePerformance clinicalServiceId must match appointment clinicalServiceId',
      );
    }
  }

  if (performance.snapshotRevisionId != null) {
    const rev = await tx.appointmentServiceSnapshotRevision.findFirst({
      where: { id: performance.snapshotRevisionId, tenantId },
      select: { id: true, appointmentId: true },
    });
    if (!rev) {
      throw new BadRequestException('ServicePerformance snapshotRevisionId not found for tenant');
    }
    if (
      performance.appointmentId != null &&
      rev.appointmentId !== performance.appointmentId
    ) {
      throw new BadRequestException(
        'snapshotRevisionId must belong to the same appointment as ServicePerformance',
      );
    }
  }

  const svc = await tx.canonicalClinicalServiceDefinition.findFirst({
    where: { id: performance.clinicalServiceId },
    select: { id: true },
  });
  if (!svc) {
    throw new BadRequestException('Clinical service for performance not found');
  }

  void line.serviceCode; // never authoritative alone (Round 2)
}

@Injectable()
export class CommissionAccrualService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly plans: StaffCommissionPlanService,
    @Inject(WAVE_F_AUDIT_LOG) private readonly audit: WaveFAuditLog,
  ) {}

  async postFromServicePerformance(
    input: {
      servicePerformanceId: string;
      invoiceLineId: string;
      actor: string | WaveFActor;
      actorRoles?: string[];
      reason?: string | null;
      correctionEventId?: string | null;
    },
    externalTx?: Prisma.TransactionClient,
  ) {
    const tenantId = await this.requireTenant();
    const { actorId, actorRoles } = this.normalizeActor(input.actor, input.actorRoles);
    const performanceId = assertUuid(input.servicePerformanceId, 'servicePerformanceId');
    const invoiceLineId = assertUuid(input.invoiceLineId, 'invoiceLineId');
    assertNoAppointmentProviderBlindAttribution();

    const run = async (tx: Prisma.TransactionClient) => {
      // R7-B — shared cross-basis serialization BEFORE opposing-accrual / package decisions.
      await this.lockCrossBasisEconomicScope(tx, tenantId, performanceId);

      const performance = await tx.servicePerformance.findFirst({
        where: { id: performanceId, tenantId, deletedAt: null },
        include: {
          participants: true,
        },
      });
      if (!performance) throw new NotFoundException('Service performance not found');
      if (performance.status !== ServicePerformanceStatus.COMPLETED) {
        throw new BadRequestException(
          `Service performance must be COMPLETED to post commission (was ${performance.status})`,
        );
      }

      const line = await tx.invoiceLineItem.findFirst({
        where: { id: invoiceLineId, tenantId },
        include: {
          invoice: {
            select: {
              id: true,
              tenantId: true,
              currency: true,
              branchId: true,
              patientId: true,
              amountTotal: true,
              status: true,
            },
          },
        },
      });
      if (!line || line.invoice.tenantId !== tenantId) {
        throw new NotFoundException('Invoice line not found for tenant');
      }

      await assertPerformanceInvoiceLineLinkage(tx, tenantId, performance, line, line.invoice);

      // R4-F2 — actual invoice finalization gate (not plan enum alone).
      assertInvoiceChargeFinalized(String(line.invoice.status));

      // R4-PACKAGE — explicit allocation required when course/package context exists.
      const packageAllocation = await this.resolvePackageAllocationForPost(
        tx,
        tenantId,
        performanceId,
        line,
      );

      // R7-B — serialize package allocation decisions after resolve.
      if (packageAllocation) {
        await this.lockPackageAllocationScope(tx, tenantId, packageAllocation.id);
      }

      // R6-PKG-CURRENCY — package allocation currency must equal invoice currency.
      if (packageAllocation) {
        const allocCurrency = String(packageAllocation.currency ?? '').trim().toUpperCase();
        const invoiceCurrency = String(line.invoice.currency ?? '').trim().toUpperCase();
        if (allocCurrency !== invoiceCurrency) {
          throw new BadRequestException(
            'Package allocation currency must match invoice currency (no FX conversion)',
          );
        }
        // R6-PKG-COLLECTED — cannot invoice-earn same package allocation already collected-earned.
        const collectedOpen = await tx.commissionAccrual.findMany({
          where: {
            tenantId,
            packageAllocationId: packageAllocation.id,
            calculationBasis: CommissionCalculationBasis.COLLECTED_REVENUE,
            reversalOfAccrualId: null,
          },
          select: { id: true, commissionAmount: true },
        });
        for (const row of collectedOpen) {
          const rem = await this.remainingCommissionAbs(tx, tenantId, row.id, row.commissionAmount);
          if (rem.gt(0)) {
            throw new BadRequestException(
              'Package allocation already earned via COLLECTED_REVENUE; invoice-based post would double-earn',
            );
          }
        }
      }

      // F3: one open economic allocation per performance — ignore fully-reversed originals.
      const existingForPerf = await tx.commissionAccrual.findMany({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          reversalOfAccrualId: null,
          NOT: { invoiceLineId },
        },
        select: { id: true, invoiceLineId: true, commissionAmount: true },
      });
      for (const row of existingForPerf) {
        const rem = await this.remainingCommissionAbs(tx, tenantId, row.id, row.commissionAmount);
        if (rem.gt(0)) {
          throw new BadRequestException(
            'ServicePerformance already accrued against a different invoice line; cannot reallocate',
          );
        }
      }

      const participantUserIds = [...new Set(performance.participants.map((p) => p.userId))];
      const users = await tx.user.findMany({
        where: { id: { in: participantUserIds }, tenantId, deletedAt: null },
        select: { id: true, commissionEnabled: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));

      const eligibleParticipants = performance.participants
        .filter((p) => userMap.get(p.userId)?.commissionEnabled === true)
        .slice()
        .sort((a, b) => a.userId.localeCompare(b.userId));

      if (eligibleParticipants.length === 0) {
        return { accruals: [], skipped: 'no_commission_enabled_participants' as const };
      }

      for (const p of eligibleParticipants) {
        assertNotSelfEdit(actorId, actorRoles, p.userId);
      }

      const shares = this.resolveAttributionShares(eligibleParticipants);
      const shareSum = shares.reduce((acc, s) => acc.add(s), new Prisma.Decimal(0));
      if (shareSum.gt(100)) {
        throw new BadRequestException('Participant attribution share sum must be <= 100');
      }

      const atDate = performance.completedAt ?? performance.performedAt;
      const created: Array<Record<string, unknown>> = [];

      const planByUser = new Map<
        string,
        Awaited<ReturnType<StaffCommissionPlanService['resolveActivePlan']>>
      >();
      for (const p of eligibleParticipants) {
        const plan = await this.plans.resolveActivePlan(tx, tenantId, p.userId, atDate);
        if (plan.calculationBasis === CommissionCalculationBasis.COLLECTED_REVENUE) {
          throw new BadRequestException(
            'COLLECTED_REVENUE accruals are not posted via service-performance path',
          );
        }
        if (plan.earningTrigger !== CommissionEarningTrigger.INVOICE_OR_CHARGE_FINALIZED) {
          throw new BadRequestException(
            'Invoice/charge accrual path requires earningTrigger INVOICE_OR_CHARGE_FINALIZED',
          );
        }
        planByUser.set(p.userId, plan);
      }

      const bases = [...planByUser.values()].map((p) => p.calculationBasis);
      const uniqueBases = [...new Set(bases)];
      const attributedByUser = new Map<string, Prisma.Decimal>();

      const lineBasisSource = packageAllocation
        ? {
            subtotal: packageAllocation.allocatedRevenueAmount,
            discountAmount: new Prisma.Decimal(0),
            lineTotal: packageAllocation.allocatedRevenueAmount,
            taxAmount: new Prisma.Decimal(0),
          }
        : line;

      if (uniqueBases.length === 1) {
        const basisAmount = this.basisAmount(uniqueBases[0]!, lineBasisSource);
        const parts = splitByShares(basisAmount, shares);
        eligibleParticipants.forEach((p, i) => {
          attributedByUser.set(p.userId, parts[i]!);
        });
      } else {
        eligibleParticipants.forEach((p, i) => {
          const plan = planByUser.get(p.userId)!;
          const basisAmount = this.basisAmount(plan.calculationBasis, lineBasisSource);
          attributedByUser.set(p.userId, roundMoney(basisAmount.mul(shares[i]!).div(100)));
        });
      }

      for (const participant of eligibleParticipants) {
        const plan = planByUser.get(participant.userId)!;
        const attributedRevenue = attributedByUser.get(participant.userId)!;
        const commissionAmount = roundMoney(attributedRevenue.mul(plan.percentage).div(100));
        let idempotencyKey: string;
        if (input.correctionEventId) {
          // R9-D — each correction event gets its own successor key (never reuse :after:firstRoot).
          idempotencyKey = `earn:${performanceId}:${participant.userId}:${invoiceLineId}:corr:${input.correctionEventId}`;
          const existingCorr = await tx.commissionAccrual.findFirst({
            where: { tenantId, idempotencyKey },
          });
          if (existingCorr) {
            if (
              existingCorr.userId !== participant.userId ||
              existingCorr.servicePerformanceId !== performanceId ||
              existingCorr.invoiceLineId !== invoiceLineId ||
              existingCorr.correctionEventId !== input.correctionEventId
            ) {
              throw new BadRequestException(
                'Correction idempotency key conflict with mismatched economic identity',
              );
            }
            created.push(existingCorr);
            continue;
          }
        } else {
          idempotencyKey = `earn:${performanceId}:${participant.userId}`;
          const priorEarn = await tx.commissionAccrual.findFirst({
            where: { tenantId, idempotencyKey },
          });
          if (priorEarn) {
            const rem = await this.remainingCommissionAbs(
              tx,
              tenantId,
              priorEarn.id,
              priorEarn.commissionAmount,
            );
            if (rem.gt(0)) {
              created.push(priorEarn);
              continue;
            }
            // Fully reversed prior earn — allow a non-correction successor once.
            idempotencyKey = `earn:${performanceId}:${participant.userId}:after:${priorEarn.id}`;
          }
        }

        try {
          const accrual = await withSavepoint(tx, `wf_earn_${participant.userId.slice(0, 8)}`, () =>
            tx.commissionAccrual.create({
              data: {
                id: randomUUID(),
                tenantId,
                branchId: performance.branchId ?? line.invoice.branchId ?? null,
                userId: participant.userId,
                servicePerformanceId: performanceId,
                appointmentId: performance.appointmentId,
                clinicalServiceId: performance.clinicalServiceId,
                snapshotRevisionId: performance.snapshotRevisionId,
                invoiceId: line.invoiceId,
                invoiceLineId,
                packageAllocationId: packageAllocation?.id ?? null,
                correctionEventId: input.correctionEventId ?? null,
                commissionPlanVersionId: plan.id,
                calculationBasis: plan.calculationBasis,
                attributedRevenueAmount: attributedRevenue,
                commissionPercent: plan.percentage,
                commissionAmount,
                currency: line.invoice.currency,
                status: CommissionAccrualStatus.EARNED,
                earnedAt: new Date(),
                idempotencyKey,
                reason: input.reason?.trim() || null,
                createdBy: actorId,
              },
            }),
          );

          await this.audit.recordInTransaction(tx, {
            tenantId,
            actorId,
            actorRoles,
            action: 'staff_commission.accrual.created',
            resourceId: accrual.id,
            descriptionEn: 'Commission accrual earned from service performance',
            details: {
              servicePerformanceId: performanceId,
              invoiceLineId,
              userId: participant.userId,
              commissionAmount: commissionAmount.toString(),
              packageAllocationId: packageAllocation?.id ?? null,
              invoiceStatus: line.invoice.status,
            },
          });

          if (packageAllocation && !packageAllocation.financiallyConsumedAt) {
            await tx.commissionPackageSessionAllocation.update({
              where: { id: packageAllocation.id },
              data: {
                financiallyConsumedAt: new Date(),
                invoiceLineId: packageAllocation.invoiceLineId ?? invoiceLineId,
              },
            });
            packageAllocation.financiallyConsumedAt = new Date();
            if (!packageAllocation.invoiceLineId) {
              packageAllocation.invoiceLineId = invoiceLineId;
            }
          }

          created.push(accrual);
        } catch (err) {
          if (!isUniqueConflict(err)) throw err;
          const existing = await tx.commissionAccrual.findFirst({
            where: { tenantId, idempotencyKey },
          });
          if (!existing) throw err;
          // R9-D — never accept a mismatched or fully-reversed stale successor for a new correction event.
          if (input.correctionEventId) {
            if (
              existing.correctionEventId !== input.correctionEventId ||
              existing.invoiceLineId !== invoiceLineId ||
              existing.userId !== participant.userId
            ) {
              throw new BadRequestException(
                'Unique conflict returned a stale/mismatched correction successor; fail closed',
              );
            }
          } else {
            const rem = await this.remainingCommissionAbs(
              tx,
              tenantId,
              existing.id,
              existing.commissionAmount,
            );
            if (rem.lte(0) && existing.idempotencyKey.includes(':after:')) {
              throw new BadRequestException(
                'Unique conflict returned a fully reversed predecessor successor; fail closed',
              );
            }
          }
          created.push(existing);
        }
      }

      return { accruals: created };
    };

    if (externalTx) return run(externalTx);
    return this.prisma.withPlatformBypass(run);
  }

  async postFromCollectedPayment(
    input: {
      servicePerformanceId: string;
      invoiceLineId: string;
      paymentId: string;
      actor: string | WaveFActor;
      actorRoles?: string[];
      reason?: string | null;
      correctionEventId?: string | null;
    },
    externalTx?: Prisma.TransactionClient,
  ) {
    const tenantId = await this.requireTenant();
    const { actorId, actorRoles } = this.normalizeActor(input.actor, input.actorRoles);
    const performanceId = assertUuid(input.servicePerformanceId, 'servicePerformanceId');
    const invoiceLineId = assertUuid(input.invoiceLineId, 'invoiceLineId');
    const paymentId = assertUuid(input.paymentId, 'paymentId');
    assertNoAppointmentProviderBlindAttribution();

    const run = async (tx: Prisma.TransactionClient) => {
      // R7-B — shared cross-basis serialization (same lock as invoice-based path).
      await this.lockCrossBasisEconomicScope(tx, tenantId, performanceId);

      const performance = await tx.servicePerformance.findFirst({
        where: { id: performanceId, tenantId, deletedAt: null },
        include: { participants: true },
      });
      if (!performance) throw new NotFoundException('Service performance not found');
      if (performance.status !== ServicePerformanceStatus.COMPLETED) {
        throw new BadRequestException(
          `Service performance must be COMPLETED to post commission (was ${performance.status})`,
        );
      }

      const line = await tx.invoiceLineItem.findFirst({
        where: { id: invoiceLineId, tenantId },
        include: {
          invoice: {
            select: {
              id: true,
              tenantId: true,
              currency: true,
              branchId: true,
              patientId: true,
              amountTotal: true,
            },
          },
        },
      });
      if (!line || line.invoice.tenantId !== tenantId) {
        throw new NotFoundException('Invoice line not found for tenant');
      }

      await assertPerformanceInvoiceLineLinkage(tx, tenantId, performance, line, line.invoice);

      // R6-PKG-COLLECTED — resolve package allocation for collected-revenue path.
      const packageAllocation = await this.resolvePackageAllocationForPost(
        tx,
        tenantId,
        performanceId,
        line,
      );

      if (packageAllocation) {
        await this.lockPackageAllocationScope(tx, tenantId, packageAllocation.id);
      }

      if (packageAllocation) {
        const allocCurrency = String(packageAllocation.currency ?? '').trim().toUpperCase();
        const invoiceCurrency = String(line.invoice.currency ?? '').trim().toUpperCase();
        if (allocCurrency !== invoiceCurrency) {
          throw new BadRequestException(
            'Package allocation currency must match invoice currency (no FX conversion)',
          );
        }
        // Payment has no independent currency column — inherits invoice currency (schema).
        // R6-PKG-COLLECTED — cannot collected-earn same package allocation already invoice-earned.
        const invoiceOpen = await tx.commissionAccrual.findMany({
          where: {
            tenantId,
            packageAllocationId: packageAllocation.id,
            reversalOfAccrualId: null,
            NOT: { calculationBasis: CommissionCalculationBasis.COLLECTED_REVENUE },
          },
          select: { id: true, commissionAmount: true },
        });
        for (const row of invoiceOpen) {
          const rem = await this.remainingCommissionAbs(tx, tenantId, row.id, row.commissionAmount);
          if (rem.gt(0)) {
            throw new BadRequestException(
              'Package allocation already earned via invoice-based post; COLLECTED_REVENUE would double-earn',
            );
          }
        }
      }

      const existingForPerf = await tx.commissionAccrual.findMany({
        where: {
          tenantId,
          servicePerformanceId: performanceId,
          reversalOfAccrualId: null,
          NOT: { invoiceLineId },
        },
        select: { id: true, commissionAmount: true },
      });
      for (const row of existingForPerf) {
        const rem = await this.remainingCommissionAbs(tx, tenantId, row.id, row.commissionAmount);
        if (rem.gt(0)) {
          throw new BadRequestException(
            'ServicePerformance already accrued against a different invoice line; cannot reallocate',
          );
        }
      }

      const payment = await tx.invoicePayment.findFirst({
        where: { id: paymentId, tenantId, invoiceId: line.invoiceId },
      });
      if (!payment) {
        throw new NotFoundException('Invoice payment not found for tenant/invoice');
      }

      const invoiceTotal = new Prisma.Decimal(line.invoice.amountTotal);
      if (invoiceTotal.lte(0)) {
        throw new BadRequestException('invoice.amountTotal must be > 0 for collected commission');
      }

      // R7-A — package COLLECTED uses payment/invoice proportion of allocatedRevenueAmount.
      // Non-package COLLECTED preserves line-share attribution of the payment.
      let paymentAttributedToLine: Prisma.Decimal;
      let packageAttributedCap: Prisma.Decimal | null = null;
      if (packageAllocation) {
        packageAttributedCap = new Prisma.Decimal(packageAllocation.allocatedRevenueAmount);
        const paymentCollectionRatio = new Prisma.Decimal(payment.amount).div(invoiceTotal);
        const proportionalPackageRevenue = roundMoney(
          packageAttributedCap.mul(paymentCollectionRatio),
        );
        const priorPkgAttributed = await this.packageAttributedRevenueAbs(
          tx,
          tenantId,
          packageAllocation.id,
        );
        const remainingPkg = packageAttributedCap.sub(priorPkgAttributed);
        if (remainingPkg.lte(0)) {
          return { accruals: [], skipped: 'package_allocation_exhausted' as const };
        }
        paymentAttributedToLine = proportionalPackageRevenue.gt(remainingPkg)
          ? remainingPkg
          : proportionalPackageRevenue;
      } else {
        const lineShare = new Prisma.Decimal(line.lineTotal).div(invoiceTotal);
        paymentAttributedToLine = roundMoney(new Prisma.Decimal(payment.amount).mul(lineShare));
      }

      const netAfterDiscount = packageAttributedCap
        ? packageAttributedCap
        : new Prisma.Decimal(line.subtotal).sub(line.discountAmount);

      const participantUserIds = [...new Set(performance.participants.map((p) => p.userId))];
      const users = await tx.user.findMany({
        where: { id: { in: participantUserIds }, tenantId, deletedAt: null },
        select: { id: true, commissionEnabled: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));
      const eligibleParticipants = performance.participants
        .filter((p) => userMap.get(p.userId)?.commissionEnabled === true)
        .slice()
        .sort((a, b) => a.userId.localeCompare(b.userId));

      if (eligibleParticipants.length === 0) {
        return { accruals: [], skipped: 'no_commission_enabled_participants' as const };
      }

      for (const p of eligibleParticipants) {
        assertNotSelfEdit(actorId, actorRoles, p.userId);
      }

      const shares = this.resolveAttributionShares(eligibleParticipants);
      const shareSum = shares.reduce((acc, s) => acc.add(s), new Prisma.Decimal(0));
      if (shareSum.gt(100)) {
        throw new BadRequestException('Participant attribution share sum must be <= 100');
      }

      const atDate = performance.completedAt ?? performance.performedAt;
      const attributedNetParts = splitByShares(netAfterDiscount, shares);
      const paymentParts = splitByShares(paymentAttributedToLine, shares);
      const created: Array<Record<string, unknown>> = [];

      for (let i = 0; i < eligibleParticipants.length; i++) {
        const participant = eligibleParticipants[i]!;
        const plan = await this.plans.resolveActivePlan(tx, tenantId, participant.userId, atDate);
        if (plan.calculationBasis !== CommissionCalculationBasis.COLLECTED_REVENUE) {
          throw new BadRequestException(
            'Collected-payment accrual path requires calculationBasis COLLECTED_REVENUE',
          );
        }
        if (plan.earningTrigger !== CommissionEarningTrigger.PAYMENT_COLLECTED) {
          throw new BadRequestException(
            'Collected-payment accrual path requires earningTrigger PAYMENT_COLLECTED',
          );
        }

        const attributedNet = attributedNetParts[i]!;
        const paymentAttributed = paymentParts[i]!;
        const maxCommission = roundMoney(attributedNet.mul(plan.percentage).div(100));
        const commissionThisPayment = roundMoney(paymentAttributed.mul(plan.percentage).div(100));

        let idempotencyKey = input.correctionEventId
          ? `earn_pay:${performanceId}:${participant.userId}:${invoiceLineId}:${paymentId}:corr:${input.correctionEventId}`
          : `earn_pay:${performanceId}:${participant.userId}:${invoiceLineId}:${paymentId}`;
        const existingByKey = await tx.commissionAccrual.findFirst({
          where: { tenantId, idempotencyKey },
        });
        if (existingByKey) {
          created.push(existingByKey);
          continue;
        }

        const prior = await tx.commissionAccrual.findMany({
          where: {
            tenantId,
            servicePerformanceId: performanceId,
            userId: participant.userId,
            invoiceLineId,
            calculationBasis: CommissionCalculationBasis.COLLECTED_REVENUE,
            status: { in: [CommissionAccrualStatus.EARNED, CommissionAccrualStatus.SETTLED] },
            reversalOfAccrualId: null,
          },
          select: { commissionAmount: true },
        });
        const alreadyEarned = prior.reduce(
          (acc, row) => acc.add(row.commissionAmount),
          new Prisma.Decimal(0),
        );
        const remaining = maxCommission.sub(alreadyEarned);
        if (remaining.lte(0) || commissionThisPayment.lte(0)) {
          continue;
        }
        const commissionAmount = remaining.lt(commissionThisPayment)
          ? remaining
          : commissionThisPayment;

        try {
          const accrual = await withSavepoint(tx, `wf_pay_${participant.userId.slice(0, 8)}`, () =>
            tx.commissionAccrual.create({
              data: {
                id: randomUUID(),
                tenantId,
                branchId: performance.branchId ?? line.invoice.branchId ?? null,
                userId: participant.userId,
                servicePerformanceId: performanceId,
                appointmentId: performance.appointmentId,
                clinicalServiceId: performance.clinicalServiceId,
                snapshotRevisionId: performance.snapshotRevisionId,
                invoiceId: line.invoiceId,
                invoiceLineId,
                paymentId,
                packageAllocationId: packageAllocation?.id ?? null,
                correctionEventId: input.correctionEventId ?? null,
                commissionPlanVersionId: plan.id,
                calculationBasis: plan.calculationBasis,
                attributedRevenueAmount: paymentAttributed,
                commissionPercent: plan.percentage,
                commissionAmount,
                currency: line.invoice.currency,
                status: CommissionAccrualStatus.EARNED,
                earnedAt: new Date(),
                idempotencyKey,
                reason: input.reason?.trim() || null,
                createdBy: actorId,
              },
            }),
          );

          await this.audit.recordInTransaction(tx, {
            tenantId,
            actorId,
            actorRoles,
            action: 'staff_commission.accrual.created',
            resourceId: accrual.id,
            descriptionEn: 'Commission accrual earned from collected payment',
            details: {
              servicePerformanceId: performanceId,
              invoiceLineId,
              paymentId,
              userId: participant.userId,
              commissionAmount: commissionAmount.toString(),
              packageAllocationId: packageAllocation?.id ?? null,
              proportionalPackage: Boolean(packageAllocation),
            },
          });

          if (packageAllocation && !packageAllocation.financiallyConsumedAt) {
            await tx.commissionPackageSessionAllocation.update({
              where: { id: packageAllocation.id },
              data: {
                financiallyConsumedAt: new Date(),
                invoiceLineId: packageAllocation.invoiceLineId ?? invoiceLineId,
              },
            });
            packageAllocation.financiallyConsumedAt = new Date();
            if (!packageAllocation.invoiceLineId) {
              packageAllocation.invoiceLineId = invoiceLineId;
            }
          }

          created.push(accrual);
        } catch (err) {
          if (!isUniqueConflict(err)) throw err;
          const existing = await tx.commissionAccrual.findFirst({
            where: { tenantId, idempotencyKey },
          });
          if (!existing) throw err;
          if (input.correctionEventId) {
            if (
              existing.correctionEventId !== input.correctionEventId ||
              existing.invoiceLineId !== invoiceLineId ||
              existing.userId !== participant.userId ||
              existing.paymentId !== paymentId
            ) {
              throw new BadRequestException(
                'Unique conflict returned a stale/mismatched collected correction successor; fail closed',
              );
            }
          }
          created.push(existing);
        }
      }

      return { accruals: created };
    };

    if (externalTx) return run(externalTx);
    return this.prisma.withPlatformBypass(run);
  }

  async reverseAccrual(
    input: {
      accrualId: string;
      refundId: string;
      proportion?: number;
      actor: string | WaveFActor;
      actorRoles?: string[];
      reason?: string | null;
    },
    externalTx?: Prisma.TransactionClient,
  ) {
    const tenantId = await this.requireTenant();
    const { actorId, actorRoles } = this.normalizeActor(input.actor, input.actorRoles);
    const accrualId = assertUuid(input.accrualId, 'accrualId');
    if (!input.refundId?.trim()) {
      throw new BadRequestException('refundId is required for commission reversal');
    }
    if (input.proportion != null && input.proportion !== undefined) {
      throw new BadRequestException(
        'Caller-supplied proportion is not authoritative; reverse amount is derived from refund vs invoice.amountTotal',
      );
    }
    const refundId = assertUuid(input.refundId, 'refundId');
    const idempotencyKey = `rev:${accrualId}:${refundId}`;

    const run = async (tx: Prisma.TransactionClient) => {
      // R9-C — identity lookup, then SP (+ package) before accrual lock.
      const identity = await tx.commissionAccrual.findFirst({
        where: { id: accrualId, tenantId },
        select: {
          id: true,
          servicePerformanceId: true,
          packageAllocationId: true,
        },
      });
      if (!identity) throw new NotFoundException('Commission accrual not found');
      await this.lockCrossBasisEconomicScope(tx, tenantId, identity.servicePerformanceId);
      if (identity.packageAllocationId) {
        await this.lockPackageAllocationScope(tx, tenantId, identity.packageAllocationId);
      }
      await tx.$queryRaw`
        SELECT id FROM "commission_accruals"
        WHERE id = ${accrualId}::uuid AND "tenantId" = ${tenantId}::uuid
        FOR UPDATE
      `;

      const original = await tx.commissionAccrual.findFirst({
        where: { id: accrualId, tenantId },
      });
      if (!original) throw new NotFoundException('Commission accrual not found');
      assertNotSelfEdit(actorId, actorRoles, original.userId);
      if (original.reversalOfAccrualId) {
        throw new BadRequestException('Cannot reverse a reversal accrual row');
      }
      if (original.status === CommissionAccrualStatus.REVERSED) {
        throw new BadRequestException('Cannot reverse a REVERSED accrual row');
      }
      if (!original.invoiceId) {
        throw new BadRequestException('Original accrual has no invoiceId for refund-linked reverse');
      }

      // R10-A / R11-A — semantic exactly-once: never return existing without full economic validation.
      const existingRefundEffect = await this.findExistingRootRefundReversal(
        tx,
        tenantId,
        accrualId,
        refundId,
      );
      if (existingRefundEffect) {
        return this.acceptExistingRootRefundReversal(tx, tenantId, existingRefundEffect, original, {
          refundId,
          excludeAccrualId: existingRefundEffect.id,
        });
      }

      const computed = await this.computeAuthoritativeRefundReversalAmounts(
        tx,
        tenantId,
        original,
        refundId,
      );
      const reverseAmount = computed.reverseCommission;
      const reverseAttributed = computed.reverseAttributed;

      // R12-B — recoverable P2002 only around commissionAccrual.create (savepoint).
      // Audit runs after insert resolution; audit P2002 must never enter refund recovery.
      let reversal;
      try {
        reversal = await withSavepoint(tx, `wf_rev_${accrualId.slice(0, 8)}`, () =>
          tx.commissionAccrual.create({
            data: {
              id: randomUUID(),
              tenantId,
              branchId: original.branchId,
              userId: original.userId,
              servicePerformanceId: original.servicePerformanceId,
              appointmentId: original.appointmentId,
              clinicalServiceId: original.clinicalServiceId,
              snapshotRevisionId: original.snapshotRevisionId,
              invoiceId: original.invoiceId,
              invoiceLineId: original.invoiceLineId,
              paymentId: original.paymentId,
              packageAllocationId: original.packageAllocationId,
              refundId,
              commissionPlanVersionId: original.commissionPlanVersionId,
              calculationBasis: original.calculationBasis,
              attributedRevenueAmount: reverseAttributed,
              commissionPercent: original.commissionPercent,
              commissionAmount: reverseAmount,
              currency: original.currency,
              status: CommissionAccrualStatus.REVERSED,
              earnedAt: new Date(),
              reversalOfAccrualId: original.id,
              idempotencyKey,
              reason: input.reason?.trim() || null,
              createdBy: actorId,
            },
          }),
        );
      } catch (err) {
        if (!isRecoverableCommissionRefundUniqueConflict(err)) throw err;
        const existing = await this.findExistingRootRefundReversal(
          tx,
          tenantId,
          accrualId,
          refundId,
        );
        if (!existing) throw err;
        return this.acceptExistingRootRefundReversal(tx, tenantId, existing, original, {
          refundId,
          excludeAccrualId: existing.id,
        });
      }

      // R18-B — new creation must prove complete-set realizability before commit/audit.
      await this.assertRealizableRefundEffectsOnRoot(tx, tenantId, original);

      await this.audit.recordInTransaction(tx, {
        tenantId,
        actorId,
        actorRoles,
        action: 'staff_commission.accrual.reversed',
        resourceId: reversal.id,
        descriptionEn: 'Commission accrual reversed (append-only)',
        details: {
          reversalOfAccrualId: original.id,
          refundId,
          commissionAmount: reverseAmount.toString(),
          attributedRevenueAmount: reverseAttributed.toString(),
        },
      });

      return reversal;
    };

    if (externalTx) return run(externalTx);
    return this.prisma.withPlatformBypass(run);
  }

  /**
   * Frozen invoice correction: append-only full remaining reverse + re-post in ONE transaction.
   * Round 4: correction uses correctionEventId — NOT refund economics.
   * Round 8: reverse+repost the complete economic cohort (sibling payments/participants).
   * Round 9: lock SP→package→cohort(asc)→reread; settlement allocation fail-closed;
   * refund-aware carry-forward; correctionEvent-scoped successor keys.
   * Round 10: canonical rev:{root}:{refundId} carry identity (exactly-once with reverseAccrual).
   */
  async correctAndRepost(
    input: {
      accrualId: string;
      correctionEventId: string;
      replacementInvoiceLineId: string;
      actor: string | WaveFActor;
      actorRoles?: string[];
      reason: string;
    },
    externalTx?: Prisma.TransactionClient,
  ) {
    const reason = String(input.reason ?? '').trim();
    if (!reason) {
      throw new BadRequestException('reason is required for commission correction');
    }
    const tenantId = await this.requireTenant();
    const { actorId, actorRoles } = this.normalizeActor(input.actor, input.actorRoles);
    const accrualId = assertUuid(input.accrualId, 'accrualId');
    const correctionEventId = assertUuid(input.correctionEventId, 'correctionEventId');
    const replacementInvoiceLineId = assertUuid(
      input.replacementInvoiceLineId,
      'replacementInvoiceLineId',
    );
    const correctionIdempotencyKey = `correct:${accrualId}:${correctionEventId}`;

    const run = async (tx: Prisma.TransactionClient) => {
      // R9-C — unlocked identity lookup only (no financial decisions yet).
      const identity = await tx.commissionAccrual.findFirst({
        where: { id: accrualId, tenantId },
        select: {
          id: true,
          servicePerformanceId: true,
          packageAllocationId: true,
          invoiceLineId: true,
          calculationBasis: true,
          reversalOfAccrualId: true,
        },
      });
      if (!identity) throw new NotFoundException('Commission accrual not found');
      if (identity.reversalOfAccrualId) {
        throw new BadRequestException('Cannot correct a reversal accrual row');
      }
      if (!identity.invoiceLineId) {
        throw new BadRequestException('Original accrual missing invoiceLineId');
      }
      if (replacementInvoiceLineId === identity.invoiceLineId) {
        throw new BadRequestException(
          'Correction must repost against a corrected replacement invoice line (not the stale source)',
        );
      }

      // R9-C / R13-A lock order: ServicePerformance → package → invoice lines → cohort roots.
      await this.lockCrossBasisEconomicScope(tx, tenantId, identity.servicePerformanceId);
      if (identity.packageAllocationId) {
        await this.lockPackageAllocationScope(tx, tenantId, identity.packageAllocationId);
      }
      await this.lockInvoiceLineBindingScope(
        tx,
        tenantId,
        identity.servicePerformanceId,
        replacementInvoiceLineId,
      );

      // Post-scope-lock reread of selected accrual; verify identity/scope unchanged.
      // Accrual row locks are acquired only via loadCorrectionCohort (ORDER BY id).
      const original = await tx.commissionAccrual.findFirst({
        where: { id: accrualId, tenantId },
      });
      if (!original) throw new NotFoundException('Commission accrual not found');
      if (
        original.servicePerformanceId !== identity.servicePerformanceId ||
        (original.packageAllocationId ?? null) !== (identity.packageAllocationId ?? null) ||
        original.invoiceLineId !== identity.invoiceLineId ||
        original.calculationBasis !== identity.calculationBasis
      ) {
        throw new BadRequestException(
          'Selected accrual economic scope changed under concurrency; fail closed',
        );
      }
      if (original.reversalOfAccrualId) {
        throw new BadRequestException('Cannot correct a reversal accrual row');
      }
      if (!original.invoiceLineId) {
        throw new BadRequestException('Original accrual missing invoiceLineId');
      }

      // R14-B — durable correction lineage is the authoritative same-event replay identity.
      const existingLineage = await tx.commissionCorrectionLineage.findFirst({
        where: { tenantId, correctionEventId },
      });
      if (existingLineage) {
        return this.buildIdempotentCorrectionReplayFromLineage({
          tx,
          tenantId,
          original,
          replacementInvoiceLineId,
          correctionEventId,
          correctionIdempotencyKey,
          lineage: existingLineage,
        });
      }

      // R15-C — never treat a historically used correctionEventId without lineage as new.
      const historicalCorrectionEvidence = await tx.commissionAccrual.findFirst({
        where: { tenantId, correctionEventId },
        select: { id: true, servicePerformanceId: true },
      });
      if (historicalCorrectionEvidence) {
        throw new BadRequestException(
          'correctionEventId has historical correction economics without durable lineage; fail closed (pre-R14/unsupported historical event)',
        );
      }

      const foreignEventUse = await tx.commissionAccrual.findFirst({
        where: {
          tenantId,
          correctionEventId,
          NOT: { servicePerformanceId: original.servicePerformanceId },
        },
      });
      if (foreignEventUse) {
        throw new BadRequestException(
          'correctionEventId already used for a different correction scope (idempotency conflict)',
        );
      }

      // R13-A — new event may only correct the current ACTIVE source (I2–I5).
      await this.assertNewCorrectionCurrentSourceGuard(
        tx,
        tenantId,
        original,
        replacementInvoiceLineId,
        correctionEventId,
      );

      // R9-C — lock all candidate cohort roots (ORDER BY id), then reread remaining/status/settlements.
      const cohort = await this.loadCorrectionCohort(
        tx,
        tenantId,
        original.servicePerformanceId,
        original.invoiceLineId,
        original.calculationBasis,
      );
      if (!cohort.some((r) => r.id === original.id)) {
        const rem = await this.remainingCommissionAbs(
          tx,
          tenantId,
          original.id,
          original.commissionAmount,
        );
        if (rem.lte(0)) {
          throw new BadRequestException(
            'Selected accrual has no remaining open economics and no prior correction result for this correctionEventId',
          );
        }
        throw new BadRequestException(
          'Selected accrual is not an open correctable root in the economic cohort',
        );
      }

      for (const root of cohort) {
        if (root.status === CommissionAccrualStatus.SETTLED) {
          throw new BadRequestException(
            'Correction cohort contains SETTLED accrual; settle/finalize constraints fail closed',
          );
        }
        // R9-B — any positive settlement allocation blocks the entire cohort.
        await this.assertNoSettlementAllocationsBlockCorrection(tx, tenantId, root.id);
        const remComm = await this.remainingCommissionAbs(
          tx,
          tenantId,
          root.id,
          root.commissionAmount,
        );
        const priorRevRows = await tx.commissionAccrual.findMany({
          where: {
            tenantId,
            reversalOfAccrualId: root.id,
            status: CommissionAccrualStatus.REVERSED,
          },
          select: { attributedRevenueAmount: true },
        });
        const remRev = new Prisma.Decimal(root.attributedRevenueAmount).sub(
          priorRevRows.reduce(
            (a, r) => a.add(new Prisma.Decimal(r.attributedRevenueAmount).abs()),
            new Prisma.Decimal(0),
          ),
        );
        if (remComm.lte(0) && remRev.lte(0)) {
          const refundEffects = await tx.commissionAccrual.count({
            where: {
              tenantId,
              reversalOfAccrualId: root.id,
              status: CommissionAccrualStatus.REVERSED,
              refundId: { not: null },
            },
          });
          if (refundEffects === 0) {
            throw new BadRequestException(
              'Correction cohort contains fully reversed accrual; fail closed',
            );
          }
          // R12-A / R14 — both dimensions exhausted with refund history is correctable.
        }
      }

      const replacement = await tx.invoiceLineItem.findFirst({
        where: { id: replacementInvoiceLineId, tenantId },
        include: {
          invoice: {
            select: {
              id: true,
              status: true,
              tenantId: true,
              patientId: true,
              branchId: true,
              currency: true,
              amountTotal: true,
            },
          },
        },
      });
      if (!replacement || replacement.invoice.tenantId !== tenantId) {
        throw new NotFoundException('Replacement invoice line not found for tenant');
      }

      if (
        original.currency &&
        String(replacement.invoice.currency).trim().toUpperCase() !==
          String(original.currency).trim().toUpperCase()
      ) {
        throw new BadRequestException(
          'Correction replacement invoice currency must match original accrual currency',
        );
      }
      if (original.packageAllocationId) {
        const alloc = await tx.commissionPackageSessionAllocation.findFirst({
          where: { id: original.packageAllocationId, tenantId },
          select: { currency: true },
        });
        if (
          alloc &&
          String(alloc.currency ?? '')
            .trim()
            .toUpperCase() !==
            String(replacement.invoice.currency ?? '')
              .trim()
              .toUpperCase()
        ) {
          throw new BadRequestException(
            'Correction replacement invoice currency must match package allocation currency',
          );
        }
      }

      if (
        original.calculationBasis === CommissionCalculationBasis.COLLECTED_REVENUE &&
        original.invoiceId &&
        replacement.invoiceId !== original.invoiceId
      ) {
        throw new BadRequestException(
          'COLLECTED_REVENUE correction requires same-invoice replacement; cross-invoice payment migration is not authorized',
        );
      }

      const performanceForBind = await tx.servicePerformance.findFirst({
        where: { id: original.servicePerformanceId, tenantId, deletedAt: null },
      });
      if (!performanceForBind) {
        throw new NotFoundException('Original ServicePerformance not found for correction binding');
      }

      // R14-B — write durable request lineage before economic mutation; roll back with txn.
      // Concurrent exact same-event: unique conflict recovers to idempotent replay.
      try {
        await tx.commissionCorrectionLineage.create({
          data: {
            id: randomUUID(),
            tenantId,
            correctionEventId,
            selectedAccrualId: original.id,
            sourceInvoiceLineId: original.invoiceLineId,
            replacementInvoiceLineId,
            servicePerformanceId: original.servicePerformanceId,
            calculationBasis: original.calculationBasis,
            packageAllocationId: original.packageAllocationId ?? null,
            createdBy: actorId,
          },
        });
      } catch (err) {
        if (!isUniqueConflict(err)) throw err;
        const raced = await tx.commissionCorrectionLineage.findFirst({
          where: { tenantId, correctionEventId },
        });
        if (!raced) throw err;
        return this.buildIdempotentCorrectionReplayFromLineage({
          tx,
          tenantId,
          original,
          replacementInvoiceLineId,
          correctionEventId,
          correctionIdempotencyKey,
          lineage: raced,
        });
      }

      await this.audit.recordInTransaction(tx, {
        tenantId,
        actorId,
        actorRoles,
        action: 'staff_commission.correction.lineage_recorded',
        resourceId: original.id,
        descriptionEn: 'Commission correction lineage recorded',
        details: {
          correctionEventId,
          selectedAccrualId: original.id,
          sourceInvoiceLineId: original.invoiceLineId,
          replacementInvoiceLineId,
          servicePerformanceId: original.servicePerformanceId,
          calculationBasis: original.calculationBasis,
          packageAllocationId: original.packageAllocationId ?? null,
        },
      });

      const superseded = await tx.invoiceLineItem.updateMany({
        where: {
          id: original.invoiceLineId,
          tenantId,
          performanceBindingStatus: 'ACTIVE',
        },
        data: { performanceBindingStatus: 'SUPERSEDED' },
      });
      // I5 — ACTIVE→SUPERSEDED must affect exactly one expected source row.
      if (superseded.count !== 1) {
        throw new BadRequestException(
          `ACTIVE→SUPERSEDED affected ${superseded.count} rows; expected exactly 1 (stale or concurrent source)`,
        );
      }

      const lineForValidation = {
        ...replacement,
        servicePerformanceId: original.servicePerformanceId,
      };
      await assertTwoWayInvoiceLinePerformanceProvenance(
        tx,
        tenantId,
        lineForValidation,
        performanceForBind,
        {
          patientId: replacement.invoice.patientId,
          branchId: replacement.invoice.branchId,
        },
        { requireDurableContext: true },
      );

      if (!replacement.servicePerformanceId) {
        await tx.invoiceLineItem.update({
          where: { id: replacementInvoiceLineId },
          data: {
            servicePerformanceId: original.servicePerformanceId,
            performanceBindingStatus: 'ACTIVE',
          },
        });
      } else if (replacement.servicePerformanceId !== original.servicePerformanceId) {
        throw new BadRequestException(
          'Replacement invoice line servicePerformanceId must match original accrual performance',
        );
      } else if (replacement.performanceBindingStatus !== 'ACTIVE') {
        await tx.invoiceLineItem.update({
          where: { id: replacementInvoiceLineId },
          data: { performanceBindingStatus: 'ACTIVE' },
        });
      }

      const reversals: Array<Record<string, unknown>> = [];
      for (const root of cohort) {
        const remComm = await this.remainingCommissionAbs(
          tx,
          tenantId,
          root.id,
          root.commissionAmount,
        );
        const priorRevRows = await tx.commissionAccrual.findMany({
          where: {
            tenantId,
            reversalOfAccrualId: root.id,
            status: CommissionAccrualStatus.REVERSED,
          },
          select: { attributedRevenueAmount: true },
        });
        const remRev = new Prisma.Decimal(root.attributedRevenueAmount).sub(
          priorRevRows.reduce(
            (a, r) => a.add(new Prisma.Decimal(r.attributedRevenueAmount).abs()),
            new Prisma.Decimal(0),
          ),
        );
        if (remComm.lte(0) && remRev.lte(0)) {
          // R12-A / R14 — both dimensions exhausted: no correction reverse; repost + carry only.
          const refundEffects = await tx.commissionAccrual.count({
            where: {
              tenantId,
              reversalOfAccrualId: root.id,
              status: CommissionAccrualStatus.REVERSED,
              refundId: { not: null },
            },
          });
          if (refundEffects === 0) {
            throw new BadRequestException(
              'Correction cohort contains fully reversed accrual; fail closed',
            );
          }
          continue;
        }
        const rev = await this.reverseAccrualForCorrection(
          {
            accrualId: root.id,
            correctionEventId,
            actor: input.actor,
            actorRoles: input.actorRoles,
            reason: `correction-reverse: ${reason}`,
          },
          tx,
        );
        reversals.push(rev as Record<string, unknown>);
      }

      let repostAccruals: Array<{
        id: string;
        userId: string;
        paymentId: string | null;
        commissionAmount: Prisma.Decimal;
        attributedRevenueAmount: Prisma.Decimal;
        currency: string;
        packageAllocationId: string | null;
        commissionPlanVersionId: string;
        calculationBasis: CommissionCalculationBasis;
        commissionPercent: Prisma.Decimal;
        branchId: string | null;
        servicePerformanceId: string;
        appointmentId: string | null;
        clinicalServiceId: string;
        snapshotRevisionId: string | null;
        invoiceId: string | null;
        invoiceLineId: string | null;
      }> = [];
      if (original.calculationBasis === CommissionCalculationBasis.COLLECTED_REVENUE) {
        const paymentIds = [
          ...new Set(
            cohort
              .map((r) => r.paymentId)
              .filter((p): p is string => typeof p === 'string' && p.length > 0),
          ),
        ].sort();
        if (paymentIds.length === 0) {
          throw new BadRequestException(
            'COLLECTED_REVENUE correction cohort has no paymentId for authoritative repost',
          );
        }
        for (const paymentId of paymentIds) {
          const payment = await tx.invoicePayment.findFirst({
            where: { id: paymentId, tenantId, invoiceId: replacement.invoiceId },
          });
          if (!payment) {
            throw new BadRequestException(
              'COLLECTED_REVENUE correction payment is not owned by the replacement invoice',
            );
          }
          const posted = await this.postFromCollectedPayment(
            {
              servicePerformanceId: original.servicePerformanceId,
              invoiceLineId: replacementInvoiceLineId,
              paymentId,
              actor: input.actor,
              actorRoles: input.actorRoles,
              reason: `correction-repost: ${reason}`,
              correctionEventId,
            },
            tx,
          );
          repostAccruals = repostAccruals.concat(
            (posted.accruals ?? []) as typeof repostAccruals,
          );
        }
      } else {
        const posted = await this.postFromServicePerformance(
          {
            servicePerformanceId: original.servicePerformanceId,
            invoiceLineId: replacementInvoiceLineId,
            actor: input.actor,
            actorRoles: input.actorRoles,
            reason: `correction-repost: ${reason}`,
            correctionEventId,
          },
          tx,
        );
        repostAccruals = (posted.accruals ?? []) as typeof repostAccruals;
      }

      if (!repostAccruals.length) {
        throw new BadRequestException(
          'Correction repost produced no accruals; correction rolled back (fail-closed)',
        );
      }

      // R9-A / R10-A — carry authoritative prior refund economics onto replacement roots.
      const refundCarryForwards = await this.carryForwardPriorRefundReversals({
        tx,
        tenantId,
        actorId,
        actorRoles,
        correctionEventId,
        reason,
        oldRoots: cohort,
        newRoots: repostAccruals,
      });

      await this.audit.recordInTransaction(tx, {
        tenantId,
        actorId,
        actorRoles,
        action: 'staff_commission.accrual.corrected',
        resourceId: accrualId,
        descriptionEn: 'Commission accrual corrected (atomic cohort reverse + re-post)',
        details: {
          correctionIdempotencyKey,
          correctionEventId,
          staleInvoiceLineId: original.invoiceLineId,
          replacementInvoiceLineId,
          cohortRootIds: cohort.map((r) => r.id).join(','),
          reversalIds: reversals.map((r) => String(r.id)).join(','),
          reversalId: (reversals[0] as { id: string } | undefined)?.id ?? null,
          refundCarryForwardIds: refundCarryForwards.map((r) => r.id).join(','),
          repostCount: repostAccruals.length,
          calculationBasis: original.calculationBasis,
          reason,
        },
      });

      return {
        reversal: reversals[0] ?? null,
        reversals,
        refundCarryForwards,
        repost: { accruals: repostAccruals },
        cohortRootIds: cohort.map((r) => r.id),
        idempotent: false as const,
        correctionIdempotencyKey,
      };
    };

    if (externalTx) return run(externalTx);
    return this.prisma.withPlatformBypass(run);
  }

  /**
   * R9-B — any positive settlement allocation on a cohort root blocks correction.
   */
  private async assertNoSettlementAllocationsBlockCorrection(
    tx: Prisma.TransactionClient,
    tenantId: string,
    accrualId: string,
  ): Promise<void> {
    const allocs = await tx.commissionSettlementAllocation.findMany({
      where: { tenantId, accrualId },
      select: { id: true, amount: true },
    });
    const positive = allocs.filter((a) => new Prisma.Decimal(a.amount).gt(0));
    if (positive.length > 0) {
      throw new BadRequestException(
        'Correction blocked: cohort root has commission settlement allocation(s); settlement transfer is not authorized',
      );
    }
  }

  /**
   * R9-A / R10-A / R12-A — discover prior refund reversals on old cohort roots and append
   * matching reversals on replacement roots using canonical rev:{root}:{refundId}.
   * Round 12: complete-set projection preserves exact historical capped amounts; never uses
   * random UUID order as economic authority.
   */
  private async carryForwardPriorRefundReversals(input: {
    tx: Prisma.TransactionClient;
    tenantId: string;
    actorId: string;
    actorRoles: string[];
    correctionEventId: string;
    reason: string;
    oldRoots: Array<{
      id: string;
      userId: string;
      paymentId: string | null;
    }>;
    newRoots: Array<{
      id: string;
      userId: string;
      paymentId: string | null;
      commissionAmount: Prisma.Decimal;
      attributedRevenueAmount: Prisma.Decimal;
      currency: string;
      packageAllocationId: string | null;
      commissionPlanVersionId: string;
      calculationBasis: CommissionCalculationBasis;
      commissionPercent: Prisma.Decimal;
      branchId: string | null;
      servicePerformanceId: string;
      appointmentId: string | null;
      clinicalServiceId: string;
      snapshotRevisionId: string | null;
      invoiceId: string | null;
      invoiceLineId: string | null;
    }>;
  }): Promise<Array<{ id: string; refundId: string | null; commissionAmount: Prisma.Decimal }>> {
    const { tx, tenantId, actorId, actorRoles, correctionEventId, reason } = input;
    const created: Array<{
      id: string;
      refundId: string | null;
      commissionAmount: Prisma.Decimal;
    }> = [];

    const matchNewRoot = (old: { userId: string; paymentId: string | null }) => {
      const matches = input.newRoots.filter((n) => {
        if (n.userId !== old.userId) return false;
        if (old.paymentId) return n.paymentId === old.paymentId;
        return true;
      });
      if (matches.length !== 1) {
        throw new BadRequestException(
          'Refund carry-forward could not uniquely match replacement root for prior refund economics',
        );
      }
      return matches[0]!;
    };

    for (const old of input.oldRoots) {
      // Load without relying on UUID order for economics (order only used later for stable insert).
      const refundReversals = await tx.commissionAccrual.findMany({
        where: {
          tenantId,
          reversalOfAccrualId: old.id,
          status: CommissionAccrualStatus.REVERSED,
          refundId: { not: null },
        },
      });
      if (refundReversals.length === 0) continue;

      const newRoot = matchNewRoot(old);
      const oldRoot = await tx.commissionAccrual.findFirst({
        where: { id: old.id, tenantId },
      });
      if (!oldRoot) {
        throw new NotFoundException('Old commission accrual root not found for refund carry');
      }

      type Projected = {
        prior: (typeof refundReversals)[number];
        refundId: string;
        carryRevAbs: Prisma.Decimal;
        carryCommAbs: Prisma.Decimal;
      };
      const projected: Projected[] = [];

      // R12-A1 — prove old-root history is realizable once (not per-row during carry).
      for (const prior of refundReversals) {
        const refundId = prior.refundId!;
        projected.push({
          prior,
          refundId,
          carryRevAbs: new Prisma.Decimal(prior.attributedRevenueAmount).abs(),
          carryCommAbs: new Prisma.Decimal(prior.commissionAmount).abs(),
        });
      }
      await this.assertRealizableRefundEffectsOnRoot(tx, tenantId, oldRoot);

      const refundIds = projected.map((p) => p.refundId);
      if (new Set(refundIds).size !== refundIds.length) {
        throw new BadRequestException(
          'Refund carry-forward found duplicate refundId effects on old root; fail closed',
        );
      }

      // R12-A aggregate replacement-root caps (order-independent).
      const totalCarryRev = projected.reduce(
        (acc, p) => acc.add(p.carryRevAbs),
        new Prisma.Decimal(0),
      );
      const totalCarryComm = projected.reduce(
        (acc, p) => acc.add(p.carryCommAbs),
        new Prisma.Decimal(0),
      );
      if (
        totalCarryRev.gt(new Prisma.Decimal(newRoot.attributedRevenueAmount)) ||
        totalCarryComm.gt(new Prisma.Decimal(newRoot.commissionAmount))
      ) {
        throw new BadRequestException(
          'Refund carry-forward aggregate exceeds replacement root economics; fail closed',
        );
      }

      // Foreign refund rows already on replacement (not in projected set) consume remaining room.
      const foreignOnNew = await tx.commissionAccrual.findMany({
        where: {
          tenantId,
          reversalOfAccrualId: newRoot.id,
          status: CommissionAccrualStatus.REVERSED,
          OR: [{ refundId: null }, { refundId: { notIn: refundIds } }],
        },
        select: { attributedRevenueAmount: true, commissionAmount: true },
      });
      const foreignRev = foreignOnNew.reduce(
        (acc, r) => acc.add(new Prisma.Decimal(r.attributedRevenueAmount).abs()),
        new Prisma.Decimal(0),
      );
      const foreignComm = foreignOnNew.reduce(
        (acc, r) => acc.add(new Prisma.Decimal(r.commissionAmount).abs()),
        new Prisma.Decimal(0),
      );
      if (
        totalCarryRev.add(foreignRev).gt(new Prisma.Decimal(newRoot.attributedRevenueAmount)) ||
        totalCarryComm.add(foreignComm).gt(new Prisma.Decimal(newRoot.commissionAmount))
      ) {
        throw new BadRequestException(
          'Refund carry-forward aggregate plus existing foreign reversals exceeds replacement root; fail closed',
        );
      }

      // Stable processing order by refundId only (not economic authority).
      projected.sort((a, b) => a.refundId.localeCompare(b.refundId));

      for (const item of projected) {
        const { prior, refundId, carryRevAbs, carryCommAbs } = item;
        const refundKey = canonicalRootRefundIdempotencyKey(newRoot.id, refundId);
        const existing = await this.findExistingRootRefundReversal(
          tx,
          tenantId,
          newRoot.id,
          refundId,
        );
        if (existing) {
          await this.acceptExistingRootRefundReversal(tx, tenantId, existing, newRoot, {
            refundId,
            excludeAccrualId: existing.id,
            priorSourceAmounts: {
              attributedRevenueAmount: prior.attributedRevenueAmount,
              commissionAmount: prior.commissionAmount,
            },
            requireCorrectionEventId: correctionEventId,
            historicalCarryExactAmounts: true,
          });
          created.push(existing);
          continue;
        }

        // R12-B — recoverable P2002 only around create; audit outside catch.
        let carry;
        try {
          carry = await withSavepoint(tx, `wf_carry_${newRoot.id.slice(0, 8)}`, () =>
            tx.commissionAccrual.create({
              data: {
                id: randomUUID(),
                tenantId,
                branchId: newRoot.branchId,
                userId: newRoot.userId,
                servicePerformanceId: newRoot.servicePerformanceId,
                appointmentId: newRoot.appointmentId,
                clinicalServiceId: newRoot.clinicalServiceId,
                snapshotRevisionId: newRoot.snapshotRevisionId,
                invoiceId: newRoot.invoiceId,
                invoiceLineId: newRoot.invoiceLineId,
                paymentId: newRoot.paymentId,
                packageAllocationId: newRoot.packageAllocationId,
                refundId,
                correctionEventId,
                commissionPlanVersionId: newRoot.commissionPlanVersionId,
                calculationBasis: newRoot.calculationBasis,
                attributedRevenueAmount: carryRevAbs.neg(),
                commissionPercent: newRoot.commissionPercent,
                commissionAmount: carryCommAbs.neg(),
                currency: newRoot.currency,
                status: CommissionAccrualStatus.REVERSED,
                earnedAt: new Date(),
                reversalOfAccrualId: newRoot.id,
                idempotencyKey: refundKey,
                reason: `correction-refund-carry: ${reason}`,
                createdBy: actorId,
              },
            }),
          );
        } catch (err) {
          if (!isRecoverableCommissionRefundUniqueConflict(err)) throw err;
          const raced = await this.findExistingRootRefundReversal(
            tx,
            tenantId,
            newRoot.id,
            refundId,
          );
          if (!raced) throw err;
          await this.acceptExistingRootRefundReversal(tx, tenantId, raced, newRoot, {
            refundId,
            excludeAccrualId: raced.id,
            priorSourceAmounts: {
              attributedRevenueAmount: prior.attributedRevenueAmount,
              commissionAmount: prior.commissionAmount,
            },
            requireCorrectionEventId: correctionEventId,
            historicalCarryExactAmounts: true,
          });
          created.push(raced);
          continue;
        }

        await this.audit.recordInTransaction(tx, {
          tenantId,
          actorId,
          actorRoles,
          action: 'staff_commission.accrual.refund_carried',
          resourceId: carry.id,
          descriptionEn: 'Prior refund economics carried onto correction replacement root',
          details: {
            priorRefundReversalId: prior.id,
            refundId,
            oldRootId: old.id,
            newRootId: newRoot.id,
            correctionEventId,
            commissionAmount: carry.commissionAmount.toString(),
            attributedRevenueAmount: carry.attributedRevenueAmount.toString(),
          },
        });

        created.push(carry);
      }

      // R12-A — after complete projected set is present, revalidate identity per row then
      // complete-set once on the replacement root (R17-C: not N× full validations).
      for (const item of projected) {
        const row = await this.findExistingRootRefundReversal(
          tx,
          tenantId,
          newRoot.id,
          item.refundId,
        );
        if (!row) {
          throw new BadRequestException(
            'Refund carry-forward incomplete after projection; fail closed',
          );
        }
        await this.acceptExistingRootRefundReversal(tx, tenantId, row, newRoot, {
          refundId: item.refundId,
          excludeAccrualId: row.id,
          priorSourceAmounts: {
            attributedRevenueAmount: item.prior.attributedRevenueAmount,
            commissionAmount: item.prior.commissionAmount,
          },
          requireCorrectionEventId: correctionEventId,
          deferCompleteSetValidation: true,
        });
      }
      await this.assertRealizableRefundEffectsOnRoot(tx, tenantId, newRoot);
    }

    return created;
  }

  /** R10-A / R11-A — locate any refund-effect row already attached to a root (any status). */
  private async findExistingRootRefundReversal(
    tx: Prisma.TransactionClient,
    tenantId: string,
    rootId: string,
    refundId: string,
  ) {
    const byKey = await tx.commissionAccrual.findFirst({
      where: { tenantId, idempotencyKey: canonicalRootRefundIdempotencyKey(rootId, refundId) },
    });
    if (byKey) return byKey;
    return tx.commissionAccrual.findFirst({
      where: {
        tenantId,
        reversalOfAccrualId: rootId,
        refundId,
      },
      orderBy: { id: 'asc' },
    });
  }

  /**
   * R11-A3 — shared server-authoritative refund economics for create and existing-row validation.
   * When excludeAccrualId is set, that row is omitted from remaining caps (multi-refund replay).
   */
  private async computeAuthoritativeRefundReversalAmounts(
    tx: Prisma.TransactionClient,
    tenantId: string,
    original: {
      id: string;
      invoiceId: string | null;
      calculationBasis: CommissionCalculationBasis;
      commissionAmount: Prisma.Decimal;
      attributedRevenueAmount: Prisma.Decimal;
    },
    refundId: string,
    opts?: { excludeAccrualId?: string },
  ): Promise<{
    reverseAttributed: Prisma.Decimal;
    reverseCommission: Prisma.Decimal;
  }> {
    if (!original.invoiceId) {
      throw new BadRequestException('Original accrual has no invoiceId for refund-linked reverse');
    }
    const refund = await tx.invoiceRefund.findFirst({
      where: { id: refundId, tenantId },
    });
    if (!refund) throw new NotFoundException('Invoice refund not found');
    if (refund.invoiceId !== original.invoiceId) {
      throw new BadRequestException('Refund invoiceId must match original accrual invoiceId');
    }

    const invoice = await tx.invoice.findFirst({
      where: { id: original.invoiceId, tenantId },
      select: { amountTotal: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found for accrual');
    const invoiceTotal = new Prisma.Decimal(invoice.amountTotal);
    if (invoiceTotal.lte(0)) {
      throw new BadRequestException('invoice.amountTotal must be > 0 for refund reverse proportion');
    }

    const priorReversals = await tx.commissionAccrual.findMany({
      where: {
        tenantId,
        reversalOfAccrualId: original.id,
        status: CommissionAccrualStatus.REVERSED,
        ...(opts?.excludeAccrualId ? { id: { not: opts.excludeAccrualId } } : {}),
      },
      select: {
        refundId: true,
        commissionAmount: true,
        attributedRevenueAmount: true,
      },
    });
    const priorReversedCommissionAbs = priorReversals.reduce(
      (acc, row) => acc.add(new Prisma.Decimal(row.commissionAmount).abs()),
      new Prisma.Decimal(0),
    );
    const priorReversedRevenueAbs = priorReversals.reduce(
      (acc, row) => acc.add(new Prisma.Decimal(row.attributedRevenueAmount).abs()),
      new Prisma.Decimal(0),
    );
    const remainingCommission = new Prisma.Decimal(original.commissionAmount).sub(
      priorReversedCommissionAbs,
    );
    const remainingRevenue = new Prisma.Decimal(original.attributedRevenueAmount).sub(
      priorReversedRevenueAbs,
    );
    // R15-A — stop only when BOTH dimensions are exhausted (not either).
    if (remainingCommission.lte(0) && remainingRevenue.lte(0)) {
      throw new BadRequestException(
        'Accrual has no remaining commission/attributed revenue to reverse',
      );
    }

    let denominator: Prisma.Decimal;
    if (original.calculationBasis === CommissionCalculationBasis.COLLECTED_REVENUE) {
      const payments = await tx.invoicePayment.findMany({
        where: { tenantId, invoiceId: original.invoiceId },
        select: { amount: true },
      });
      const collectedTotal = payments.reduce(
        (acc, p) => acc.add(p.amount),
        new Prisma.Decimal(0),
      );
      if (collectedTotal.lte(0)) {
        throw new BadRequestException(
          'COLLECTED_REVENUE refund reverse requires invoice collected payments > 0',
        );
      }
      denominator = collectedTotal;
    } else {
      denominator = invoiceTotal;
    }

    // R16-A — distinct prior refund identities contribute basis exactly once (idempotent replay).
    const priorRefundIds = [
      ...new Set(
        priorReversals
          .map((r) => r.refundId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ];
    let priorBasis = new Prisma.Decimal(0);
    if (priorRefundIds.length > 0) {
      const priorRefundRows = await tx.invoiceRefund.findMany({
        where: { tenantId, id: { in: priorRefundIds } },
        select: { id: true, amount: true },
      });
      priorBasis = priorRefundRows.reduce(
        (acc, row) => acc.add(new Prisma.Decimal(row.amount)),
        new Prisma.Decimal(0),
      );
    }

    const proportion = new Prisma.Decimal(refund.amount).div(denominator);
    const proposedCommission = roundMoney(
      new Prisma.Decimal(original.commissionAmount).mul(proportion),
    );
    const proposedRevenue = roundMoney(
      new Prisma.Decimal(original.attributedRevenueAmount).mul(proportion),
    );

    const basisAfter = roundMoney(priorBasis.add(new Prisma.Decimal(refund.amount)));
    let reverseCommissionPositive: Prisma.Decimal;
    let reverseRevenuePositive: Prisma.Decimal;
    if (basisAfter.gte(roundMoney(denominator))) {
      // Exact cumulative full-refund saturation: consume all remaining capacity.
      reverseCommissionPositive = remainingCommission.gt(0)
        ? roundMoney(remainingCommission)
        : new Prisma.Decimal(0);
      reverseRevenuePositive = remainingRevenue.gt(0)
        ? roundMoney(remainingRevenue)
        : new Prisma.Decimal(0);
    } else {
      reverseCommissionPositive = remainingCommission.lte(0)
        ? new Prisma.Decimal(0)
        : proposedCommission.gt(remainingCommission)
          ? remainingCommission
          : proposedCommission;
      reverseRevenuePositive = remainingRevenue.lte(0)
        ? new Prisma.Decimal(0)
        : proposedRevenue.gt(remainingRevenue)
          ? remainingRevenue
          : proposedRevenue;
    }

    if (reverseCommissionPositive.lte(0) && reverseRevenuePositive.lte(0)) {
      throw new BadRequestException(
        'Computed reverse amounts are zero in both dimensions; no refund effect to insert',
      );
    }

    const reverseCommission = reverseCommissionPositive.negated();
    const reverseAttributed = reverseRevenuePositive.negated();
    assertReversalSignedEconomicShape(reverseAttributed, reverseCommission);

    return {
      reverseCommission,
      reverseAttributed,
    };
  }

  /**
   * R13-B — uncapped server-authoritative refund proposal (no sibling remaining caps).
   */
  private async computeUncappedRefundProposalAmounts(
    tx: Prisma.TransactionClient,
    tenantId: string,
    original: {
      id: string;
      invoiceId: string | null;
      calculationBasis: CommissionCalculationBasis;
      commissionAmount: Prisma.Decimal;
      attributedRevenueAmount: Prisma.Decimal;
    },
    refundId: string,
  ): Promise<{ proposalRevenue: Prisma.Decimal; proposalCommission: Prisma.Decimal }> {
    if (!original.invoiceId) {
      throw new BadRequestException('Original accrual has no invoiceId for refund-linked reverse');
    }
    const refund = await tx.invoiceRefund.findFirst({
      where: { id: refundId, tenantId },
    });
    if (!refund) throw new NotFoundException('Invoice refund not found');
    if (refund.invoiceId !== original.invoiceId) {
      throw new BadRequestException('Refund invoiceId must match original accrual invoiceId');
    }
    const invoice = await tx.invoice.findFirst({
      where: { id: original.invoiceId, tenantId },
      select: { amountTotal: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found for accrual');
    const invoiceTotal = new Prisma.Decimal(invoice.amountTotal);
    if (invoiceTotal.lte(0)) {
      throw new BadRequestException('invoice.amountTotal must be > 0 for refund reverse proportion');
    }
    let proportion: Prisma.Decimal;
    if (original.calculationBasis === CommissionCalculationBasis.COLLECTED_REVENUE) {
      const payments = await tx.invoicePayment.findMany({
        where: { tenantId, invoiceId: original.invoiceId },
        select: { amount: true },
      });
      const collectedTotal = payments.reduce(
        (acc, p) => acc.add(p.amount),
        new Prisma.Decimal(0),
      );
      if (collectedTotal.lte(0)) {
        throw new BadRequestException(
          'COLLECTED_REVENUE refund reverse requires invoice collected payments > 0',
        );
      }
      proportion = new Prisma.Decimal(refund.amount).div(collectedTotal);
    } else {
      proportion = new Prisma.Decimal(refund.amount).div(invoiceTotal);
    }
    return {
      proposalCommission: roundMoney(
        new Prisma.Decimal(original.commissionAmount).mul(proportion),
      ),
      proposalRevenue: roundMoney(
        new Prisma.Decimal(original.attributedRevenueAmount).mul(proportion),
      ),
    };
  }

  /**
   * R13-B / I7 — validate complete refund-effect set on a root is sequentially realizable.
   */
  private async assertRealizableRefundEffectsOnRoot(
    tx: Prisma.TransactionClient,
    tenantId: string,
    root: {
      id: string;
      invoiceId: string | null;
      calculationBasis: CommissionCalculationBasis;
      commissionAmount: Prisma.Decimal;
      attributedRevenueAmount: Prisma.Decimal;
    },
  ): Promise<void> {
    const refundRows = await tx.commissionAccrual.findMany({
      where: {
        tenantId,
        reversalOfAccrualId: root.id,
        status: CommissionAccrualStatus.REVERSED,
        refundId: { not: null },
      },
    });
    if (refundRows.length === 0) return;

    const foreign = await tx.commissionAccrual.findMany({
      where: {
        tenantId,
        reversalOfAccrualId: root.id,
        status: CommissionAccrualStatus.REVERSED,
        refundId: null,
      },
      select: { attributedRevenueAmount: true, commissionAmount: true },
    });
    const foreignRev = foreign.reduce(
      (acc, r) => acc.add(new Prisma.Decimal(r.attributedRevenueAmount).abs()),
      new Prisma.Decimal(0),
    );
    const foreignComm = foreign.reduce(
      (acc, r) => acc.add(new Prisma.Decimal(r.commissionAmount).abs()),
      new Prisma.Decimal(0),
    );
    const capRev = roundMoney(new Prisma.Decimal(root.attributedRevenueAmount).sub(foreignRev));
    const capComm = roundMoney(new Prisma.Decimal(root.commissionAmount).sub(foreignComm));
    if (capRev.lt(0) || capComm.lt(0)) {
      throw new BadRequestException(
        'Refund complete-set not realizable (NEGATIVE_CAPACITY): foreign reversals exceed root',
      );
    }

    const effects = [];
    let denominator: Prisma.Decimal | null = null;
    for (const row of refundRows) {
      const uncapped = await this.computeUncappedRefundProposalAmounts(
        tx,
        tenantId,
        root,
        row.refundId!,
      );
      const refund = await tx.invoiceRefund.findFirst({
        where: { id: row.refundId!, tenantId },
        select: { amount: true },
      });
      if (!refund) {
        throw new BadRequestException(
          `Refund complete-set not realizable: missing InvoiceRefund ${row.refundId}`,
        );
      }
      if (denominator == null) {
        if (!root.invoiceId) {
          throw new BadRequestException(
            'Refund complete-set not realizable: root has no invoiceId for denominator',
          );
        }
        if (root.calculationBasis === CommissionCalculationBasis.COLLECTED_REVENUE) {
          const payments = await tx.invoicePayment.findMany({
            where: { tenantId, invoiceId: root.invoiceId },
            select: { amount: true },
          });
          denominator = payments.reduce(
            (acc, p) => acc.add(p.amount),
            new Prisma.Decimal(0),
          );
        } else {
          const invoice = await tx.invoice.findFirst({
            where: { id: root.invoiceId, tenantId },
            select: { amountTotal: true },
          });
          if (!invoice) {
            throw new BadRequestException(
              'Refund complete-set not realizable: invoice missing for denominator',
            );
          }
          denominator = new Prisma.Decimal(invoice.amountTotal);
        }
        if (denominator.lte(0)) {
          throw new BadRequestException(
            'Refund complete-set not realizable (NON_POSITIVE_DENOMINATOR)',
          );
        }
      }
      effects.push({
        refundId: row.refundId!,
        observedRevenue: new Prisma.Decimal(row.attributedRevenueAmount).abs(),
        observedCommission: new Prisma.Decimal(row.commissionAmount).abs(),
        proposalRevenue: uncapped.proposalRevenue,
        proposalCommission: uncapped.proposalCommission,
        refundBasisAmount: new Prisma.Decimal(refund.amount),
      });
    }
    try {
      assertRealizableRefundEffectSet(capRev, capComm, effects, denominator!);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Refund complete-set not realizable',
      );
    }
  }

  /**
   * R13-A — lock invoice lines for correction binding scope (deterministic id order).
   */
  private async lockInvoiceLineBindingScope(
    tx: Prisma.TransactionClient,
    tenantId: string,
    servicePerformanceId: string,
    replacementInvoiceLineId: string,
  ): Promise<void> {
    await tx.$queryRaw`
      SELECT id FROM "invoice_line_items"
      WHERE "tenantId" = ${tenantId}::uuid
        AND (
          "servicePerformanceId" = ${servicePerformanceId}::uuid
          OR id = ${replacementInvoiceLineId}::uuid
        )
      ORDER BY id ASC
      FOR UPDATE
    `;
  }

  /**
   * R14-B — same-event replay from durable correction lineage (not inferred from
   * correction-reverse rows; rem=0 selected roots have no non-zero reverse).
   */
  private assertCorrectionLineageMatchesRequest(input: {
    lineage: {
      selectedAccrualId: string;
      sourceInvoiceLineId: string;
      replacementInvoiceLineId: string;
      servicePerformanceId: string;
      calculationBasis: CommissionCalculationBasis;
      packageAllocationId: string | null;
    };
    original: {
      id: string;
      invoiceLineId: string | null;
      servicePerformanceId: string;
      calculationBasis: CommissionCalculationBasis;
      packageAllocationId: string | null;
    };
    replacementInvoiceLineId: string;
  }): void {
    const { lineage, original, replacementInvoiceLineId } = input;
    if (lineage.selectedAccrualId !== original.id) {
      throw new BadRequestException(
        'correctionEventId replay does not match originally selected accrualId',
      );
    }
    if (lineage.sourceInvoiceLineId !== original.invoiceLineId) {
      throw new BadRequestException(
        'correctionEventId replay does not match originally recorded source invoice line',
      );
    }
    if (lineage.replacementInvoiceLineId !== replacementInvoiceLineId) {
      throw new BadRequestException(
        'correctionEventId already used for a different replacement invoice line (idempotency conflict)',
      );
    }
    if (lineage.servicePerformanceId !== original.servicePerformanceId) {
      throw new BadRequestException(
        'correctionEventId already used for a different ServicePerformance scope (idempotency conflict)',
      );
    }
    if (lineage.calculationBasis !== original.calculationBasis) {
      throw new BadRequestException(
        'correctionEventId replay does not match originally recorded calculation basis',
      );
    }
    if ((lineage.packageAllocationId ?? null) !== (original.packageAllocationId ?? null)) {
      throw new BadRequestException(
        'correctionEventId replay does not match originally recorded package allocation scope',
      );
    }
  }

  private async buildIdempotentCorrectionReplayFromLineage(input: {
    tx: Prisma.TransactionClient;
    tenantId: string;
    original: {
      id: string;
      invoiceLineId: string | null;
      servicePerformanceId: string;
      calculationBasis: CommissionCalculationBasis;
      packageAllocationId: string | null;
      userId: string;
      paymentId: string | null;
    };
    replacementInvoiceLineId: string;
    correctionEventId: string;
    correctionIdempotencyKey: string;
    lineage: {
      selectedAccrualId: string;
      sourceInvoiceLineId: string;
      replacementInvoiceLineId: string;
      servicePerformanceId: string;
      calculationBasis: CommissionCalculationBasis;
      packageAllocationId: string | null;
    };
  }) {
    const {
      tx,
      tenantId,
      original,
      replacementInvoiceLineId,
      correctionEventId,
      correctionIdempotencyKey,
      lineage,
    } = input;
    this.assertCorrectionLineageMatchesRequest({
      lineage,
      original,
      replacementInvoiceLineId,
    });

    const priorReposts = await tx.commissionAccrual.findMany({
      where: {
        tenantId,
        servicePerformanceId: original.servicePerformanceId,
        reversalOfAccrualId: null,
        correctionEventId,
        reason: { startsWith: 'correction-repost:' },
      },
      orderBy: { id: 'asc' },
    });
    if (priorReposts.length === 0) {
      throw new BadRequestException(
        'correctionEventId lineage exists but correction repost rows are missing; fail closed',
      );
    }
    const priorReversals = await tx.commissionAccrual.findMany({
      where: {
        tenantId,
        correctionEventId,
        status: CommissionAccrualStatus.REVERSED,
        OR: [
          { reason: { startsWith: 'correction-reverse:' } },
          { reason: { startsWith: 'correction-refund-carry:' } },
        ],
      },
      orderBy: { id: 'asc' },
    });
    const corrReversals = priorReversals.filter((r) =>
      String(r.reason ?? '').startsWith('correction-reverse:'),
    );
    return {
      reversal: corrReversals[0] ?? priorReversals[0] ?? null,
      reversals: corrReversals,
      refundCarryForwards: priorReversals.filter((r) =>
        String(r.reason ?? '').startsWith('correction-refund-carry:'),
      ),
      repost: { accruals: priorReposts },
      cohortRootIds: corrReversals
        .map((r) => r.reversalOfAccrualId)
        .filter((id): id is string => Boolean(id)),
      idempotent: true as const,
      correctionIdempotencyKey,
      lineageId: (lineage as { id?: string }).id ?? null,
    };
  }

  /**
   * R13-A / I2–I5 — new correctionEventId may only mutate the current ACTIVE source.
   */
  private async assertNewCorrectionCurrentSourceGuard(
    tx: Prisma.TransactionClient,
    tenantId: string,
    original: {
      id: string;
      servicePerformanceId: string;
      invoiceLineId: string | null;
    },
    replacementInvoiceLineId: string,
    correctionEventId: string,
  ): Promise<void> {
    if (!original.invoiceLineId) {
      throw new BadRequestException('Original accrual missing invoiceLineId');
    }

    const activeLines = await tx.invoiceLineItem.findMany({
      where: {
        tenantId,
        servicePerformanceId: original.servicePerformanceId,
        performanceBindingStatus: 'ACTIVE',
      },
      orderBy: { id: 'asc' },
      select: { id: true, performanceBindingStatus: true },
    });
    if (activeLines.length !== 1) {
      throw new BadRequestException(
        `Correction requires exactly one ACTIVE invoice-line binding for ServicePerformance (found ${activeLines.length})`,
      );
    }
    if (activeLines[0]!.id !== original.invoiceLineId) {
      throw new BadRequestException(
        'Correction source invoice line is not the current ACTIVE binding; stale predecessor cannot branch',
      );
    }

    const sourceLine = await tx.invoiceLineItem.findFirst({
      where: { id: original.invoiceLineId, tenantId },
      select: {
        id: true,
        performanceBindingStatus: true,
        servicePerformanceId: true,
      },
    });
    if (!sourceLine) {
      throw new BadRequestException('Correction source invoice line missing');
    }
    if (sourceLine.performanceBindingStatus !== 'ACTIVE') {
      throw new BadRequestException(
        'Correction source invoice line is not ACTIVE (SUPERSEDED/stale source cannot correct)',
      );
    }

    const replacement = await tx.invoiceLineItem.findFirst({
      where: { id: replacementInvoiceLineId, tenantId },
      select: {
        id: true,
        performanceBindingStatus: true,
        servicePerformanceId: true,
      },
    });
    if (!replacement) {
      throw new NotFoundException('Replacement invoice line not found for tenant');
    }
    if (
      replacement.servicePerformanceId === original.servicePerformanceId &&
      replacement.performanceBindingStatus === 'ACTIVE'
    ) {
      throw new BadRequestException(
        'Replacement invoice line is already the ACTIVE binding; cannot create a correction branch onto the current successor',
      );
    }

    const priorCorrRev = await tx.commissionAccrual.findFirst({
      where: {
        tenantId,
        reversalOfAccrualId: original.id,
        reason: { startsWith: 'correction-reverse:' },
        NOT: { correctionEventId },
      },
      select: { id: true, correctionEventId: true },
    });
    if (priorCorrRev) {
      throw new BadRequestException(
        'Selected accrual already has a correction successor under a different correctionEventId',
      );
    }

    // Different-event successor reposts already exist for this performance while source claims ACTIVE
    // (should be impossible if I4 holds; fail closed).
    const foreignSuccessor = await tx.commissionAccrual.findFirst({
      where: {
        tenantId,
        servicePerformanceId: original.servicePerformanceId,
        reversalOfAccrualId: null,
        reason: { startsWith: 'correction-repost:' },
        correctionEventId: { not: null },
        NOT: { correctionEventId },
        invoiceLineId: { not: original.invoiceLineId },
      },
      select: { id: true, invoiceLineId: true, correctionEventId: true },
    });
    if (foreignSuccessor && activeLines[0]!.id === original.invoiceLineId) {
      // If a successor repost exists on another line but source is still ACTIVE, binding is inconsistent.
      // Still allow only when that successor's line is not ACTIVE (orphaned) — otherwise reject branch.
      const succLine = foreignSuccessor.invoiceLineId
        ? await tx.invoiceLineItem.findFirst({
            where: { id: foreignSuccessor.invoiceLineId, tenantId },
            select: { performanceBindingStatus: true },
          })
        : null;
      if (succLine?.performanceBindingStatus === 'ACTIVE') {
        throw new BadRequestException(
          'ServicePerformance already has an ACTIVE correction successor under a different correctionEventId',
        );
      }
    }
  }

  /**
   * R11-A — accept an existing refund-effect row only after status, sign, key policy,
   * full root provenance parity, and server-authoritative amount equality.
   */
  private async acceptExistingRootRefundReversal(
    tx: Prisma.TransactionClient,
    tenantId: string,
    existing: {
      id: string;
      tenantId: string;
      branchId: string | null;
      userId: string;
      servicePerformanceId: string;
      appointmentId: string | null;
      clinicalServiceId: string;
      snapshotRevisionId: string | null;
      invoiceId: string | null;
      invoiceLineId: string | null;
      paymentId: string | null;
      packageAllocationId: string | null;
      refundId: string | null;
      correctionEventId: string | null;
      commissionPlanVersionId: string;
      calculationBasis: CommissionCalculationBasis;
      commissionPercent: Prisma.Decimal;
      currency: string;
      status: CommissionAccrualStatus;
      reversalOfAccrualId: string | null;
      idempotencyKey: string;
      attributedRevenueAmount: Prisma.Decimal;
      commissionAmount: Prisma.Decimal;
    },
    root: {
      id: string;
      tenantId?: string;
      branchId: string | null;
      userId: string;
      servicePerformanceId: string;
      appointmentId: string | null;
      clinicalServiceId: string;
      snapshotRevisionId: string | null;
      invoiceId: string | null;
      invoiceLineId: string | null;
      paymentId: string | null;
      packageAllocationId: string | null;
      commissionPlanVersionId: string;
      calculationBasis: CommissionCalculationBasis;
      commissionPercent: Prisma.Decimal;
      currency: string;
      commissionAmount: Prisma.Decimal;
      attributedRevenueAmount: Prisma.Decimal;
    },
    opts: {
      refundId: string;
      excludeAccrualId: string;
      priorSourceAmounts?: {
        attributedRevenueAmount: Prisma.Decimal;
        commissionAmount: Prisma.Decimal;
      };
      requireCorrectionEventId?: string;
      /**
       * R12-A — when carrying historical refund effects onto a replacement root before the
       * complete sibling set is present, match priorSourceAmounts exactly and skip
       * single-row replacement recompute (complete-set recompute runs after all carries).
       */
      historicalCarryExactAmounts?: boolean;
      /** R17-C — batch carry validates complete set once after all rows are present. */
      deferCompleteSetValidation?: boolean;
    },
  ) {
    const mismatches: string[] = [];
    const existingRev = new Prisma.Decimal(existing.attributedRevenueAmount);
    const existingComm = new Prisma.Decimal(existing.commissionAmount);

    if (existing.tenantId !== tenantId) mismatches.push('tenantId');
    if (existing.reversalOfAccrualId !== root.id) mismatches.push('reversalOfAccrualId');
    if (existing.refundId !== opts.refundId) mismatches.push('refundId');
    if (existing.status !== CommissionAccrualStatus.REVERSED) mismatches.push('status');
    // R15-A — allow one-zero reversal tails; forbid positives and zero/zero.
    try {
      assertReversalSignedEconomicShape(existingRev, existingComm);
    } catch {
      mismatches.push('reversalEconomicShape');
    }
    if (!isPermittedRootRefundIdempotencyKey(existing.idempotencyKey, root.id, opts.refundId)) {
      mismatches.push('idempotencyKey');
    }

    const fieldParity: Array<[string, unknown, unknown]> = [
      ['userId', existing.userId, root.userId],
      ['servicePerformanceId', existing.servicePerformanceId, root.servicePerformanceId],
      ['appointmentId', existing.appointmentId ?? null, root.appointmentId ?? null],
      ['clinicalServiceId', existing.clinicalServiceId, root.clinicalServiceId],
      ['snapshotRevisionId', existing.snapshotRevisionId ?? null, root.snapshotRevisionId ?? null],
      ['invoiceId', existing.invoiceId ?? null, root.invoiceId ?? null],
      ['invoiceLineId', existing.invoiceLineId ?? null, root.invoiceLineId ?? null],
      ['paymentId', existing.paymentId ?? null, root.paymentId ?? null],
      ['packageAllocationId', existing.packageAllocationId ?? null, root.packageAllocationId ?? null],
      ['commissionPlanVersionId', existing.commissionPlanVersionId, root.commissionPlanVersionId],
      ['calculationBasis', existing.calculationBasis, root.calculationBasis],
      ['branchId', existing.branchId ?? null, root.branchId ?? null],
    ];
    for (const [name, left, right] of fieldParity) {
      if (left !== right) mismatches.push(name);
    }
    if (!new Prisma.Decimal(existing.commissionPercent).eq(new Prisma.Decimal(root.commissionPercent))) {
      mismatches.push('commissionPercent');
    }
    if (
      String(existing.currency).trim().toUpperCase() !==
      String(root.currency).trim().toUpperCase()
    ) {
      mismatches.push('currency');
    }
    if (opts.requireCorrectionEventId) {
      if (
        existing.correctionEventId != null &&
        existing.correctionEventId !== opts.requireCorrectionEventId
      ) {
        mismatches.push('correctionEventId');
      }
    }

    if (mismatches.length > 0) {
      throw new BadRequestException(
        `Refund idempotency conflict for root/refund identity (${mismatches.join(', ')})`,
      );
    }

    const amountMismatches: string[] = [];
    if (opts.historicalCarryExactAmounts) {
      if (!opts.priorSourceAmounts) {
        throw new BadRequestException(
          'Refund idempotency conflict for root/refund identity (missing priorSourceCarryAmounts)',
        );
      }
      const priorRevAbs = new Prisma.Decimal(opts.priorSourceAmounts.attributedRevenueAmount).abs();
      const priorCommAbs = new Prisma.Decimal(opts.priorSourceAmounts.commissionAmount).abs();
      if (!existingRev.abs().eq(priorRevAbs) || !existingComm.abs().eq(priorCommAbs)) {
        amountMismatches.push('priorSourceCarryAmounts');
      }
    } else {
      if (opts.priorSourceAmounts) {
        const priorRevAbs = new Prisma.Decimal(opts.priorSourceAmounts.attributedRevenueAmount).abs();
        const priorCommAbs = new Prisma.Decimal(opts.priorSourceAmounts.commissionAmount).abs();
        if (!existingRev.abs().eq(priorRevAbs) || !existingComm.abs().eq(priorCommAbs)) {
          amountMismatches.push('priorSourceCarryAmounts');
        }
      }
      if (amountMismatches.length === 0 && !opts.deferCompleteSetValidation) {
        // R13-B / I7 — complete-set realizability (replaces exclude-self fixed-point).
        await this.assertRealizableRefundEffectsOnRoot(tx, tenantId, root);
      }
    }
    if (amountMismatches.length > 0) {
      throw new BadRequestException(
        `Refund idempotency conflict for root/refund identity (${amountMismatches.join('; ')})`,
      );
    }

    return existing;
  }

  /**
   * R8-A / R9-C — lock candidate cohort roots in ascending id order, then reread open economics.
   */
  private async loadCorrectionCohort(
    tx: Prisma.TransactionClient,
    tenantId: string,
    servicePerformanceId: string,
    invoiceLineId: string,
    calculationBasis: CommissionCalculationBasis,
  ): Promise<
    Array<{
      id: string;
      userId: string;
      paymentId: string | null;
      commissionAmount: Prisma.Decimal;
      attributedRevenueAmount: Prisma.Decimal;
      status: CommissionAccrualStatus;
      packageAllocationId: string | null;
      currency: string;
      invoiceId: string | null;
      calculationBasis: CommissionCalculationBasis;
    }>
  > {
    // Lock the complete candidate set first (deterministic ORDER BY id).
    await tx.$queryRaw`
      SELECT id FROM "commission_accruals"
      WHERE "tenantId" = ${tenantId}::uuid
        AND "servicePerformanceId" = ${servicePerformanceId}::uuid
        AND "invoiceLineId" = ${invoiceLineId}::uuid
        AND "calculationBasis"::text = ${calculationBasis}
        AND "reversalOfAccrualId" IS NULL
        AND status IN ('EARNED', 'SETTLED')
      ORDER BY id ASC
      FOR UPDATE
    `;

    // Post-lock reread — status / remaining / settlement decisions use this snapshot only.
    const candidates = await tx.commissionAccrual.findMany({
      where: {
        tenantId,
        servicePerformanceId,
        invoiceLineId,
        calculationBasis,
        reversalOfAccrualId: null,
        status: {
          in: [CommissionAccrualStatus.EARNED, CommissionAccrualStatus.SETTLED],
        },
      },
      orderBy: { id: 'asc' },
    });
    const open: typeof candidates = [];
    for (const row of candidates) {
      const rem = await this.remainingCommissionAbs(
        tx,
        tenantId,
        row.id,
        row.commissionAmount,
      );
      const priorRevRows = await tx.commissionAccrual.findMany({
        where: {
          tenantId,
          reversalOfAccrualId: row.id,
          status: CommissionAccrualStatus.REVERSED,
        },
        select: { attributedRevenueAmount: true },
      });
      const remRev = new Prisma.Decimal(row.attributedRevenueAmount).sub(
        priorRevRows.reduce(
          (a, r) => a.add(new Prisma.Decimal(r.attributedRevenueAmount).abs()),
          new Prisma.Decimal(0),
        ),
      );
      if (rem.gt(0) || remRev.gt(0)) {
        open.push(row);
        continue;
      }
      // R12-A — fully refunded EARNED roots remain correctable so refund carries can move
      // onto the replacement root (remaining economics may be zero).
      const refundEffects = await tx.commissionAccrual.count({
        where: {
          tenantId,
          reversalOfAccrualId: row.id,
          status: CommissionAccrualStatus.REVERSED,
          refundId: { not: null },
        },
      });
      if (refundEffects > 0) open.push(row);
    }
    if (open.length === 0) {
      throw new BadRequestException('No open correctable accruals in economic cohort');
    }
    return open;
  }

  /**
   * Full remaining reverse for invoice correction (NOT refund-ratio based).
   */
  async reverseAccrualForCorrection(
    input: {
      accrualId: string;
      correctionEventId: string;
      actor: string | WaveFActor;
      actorRoles?: string[];
      reason?: string | null;
    },
    externalTx?: Prisma.TransactionClient,
  ) {
    const tenantId = await this.requireTenant();
    const { actorId, actorRoles } = this.normalizeActor(input.actor, input.actorRoles);
    const accrualId = assertUuid(input.accrualId, 'accrualId');
    const correctionEventId = assertUuid(input.correctionEventId, 'correctionEventId');
    const idempotencyKey = `rev_corr:${accrualId}:${correctionEventId}`;

    const run = async (tx: Prisma.TransactionClient) => {
      // R9-C — SP (+ package) before accrual when correction reverse runs standalone.
      const identity = await tx.commissionAccrual.findFirst({
        where: { id: accrualId, tenantId },
        select: {
          id: true,
          servicePerformanceId: true,
          packageAllocationId: true,
        },
      });
      if (!identity) throw new NotFoundException('Commission accrual not found');
      await this.lockCrossBasisEconomicScope(tx, tenantId, identity.servicePerformanceId);
      if (identity.packageAllocationId) {
        await this.lockPackageAllocationScope(tx, tenantId, identity.packageAllocationId);
      }
      await tx.$queryRaw`
        SELECT id FROM "commission_accruals"
        WHERE id = ${accrualId}::uuid AND "tenantId" = ${tenantId}::uuid
        FOR UPDATE
      `;

      const existingByKey = await tx.commissionAccrual.findFirst({
        where: { tenantId, idempotencyKey },
      });
      if (existingByKey) return existingByKey;

      const original = await tx.commissionAccrual.findFirst({
        where: { id: accrualId, tenantId },
      });
      if (!original) throw new NotFoundException('Commission accrual not found');
      assertNotSelfEdit(actorId, actorRoles, original.userId);
      if (original.reversalOfAccrualId) {
        throw new BadRequestException('Cannot reverse a reversal accrual row');
      }
      if (original.status === CommissionAccrualStatus.REVERSED) {
        throw new BadRequestException('Cannot reverse a REVERSED accrual row');
      }

      const remainingCommission = await this.remainingCommissionAbs(
        tx,
        tenantId,
        original.id,
        original.commissionAmount,
      );
      const priorReversals = await tx.commissionAccrual.findMany({
        where: {
          tenantId,
          reversalOfAccrualId: original.id,
          status: CommissionAccrualStatus.REVERSED,
        },
        select: { attributedRevenueAmount: true },
      });
      const priorReversedRevenueAbs = priorReversals.reduce(
        (acc, row) => acc.add(new Prisma.Decimal(row.attributedRevenueAmount).abs()),
        new Prisma.Decimal(0),
      );
      const remainingRevenue = new Prisma.Decimal(original.attributedRevenueAmount).sub(
        priorReversedRevenueAbs,
      );
      // R14-A — asymmetric saturation may leave revenue (or commission) residual alone.
      // Correction must reverse any remaining open dimension; zero in the exhausted dimension is OK.
      if (remainingCommission.lte(0) && remainingRevenue.lte(0)) {
        throw new BadRequestException(
          'Accrual has no remaining commission/attributed revenue to reverse for correction',
        );
      }

      const reverseAmount = remainingCommission.gt(0)
        ? remainingCommission.negated()
        : new Prisma.Decimal(0);
      const reverseAttributed = remainingRevenue.gt(0)
        ? remainingRevenue.negated()
        : new Prisma.Decimal(0);
      assertReversalSignedEconomicShape(reverseAttributed, reverseAmount);

      try {
        const reversal = await withSavepoint(tx, `wf_corr_${accrualId.slice(0, 8)}`, () =>
          tx.commissionAccrual.create({
            data: {
              id: randomUUID(),
              tenantId,
              branchId: original.branchId,
              userId: original.userId,
              servicePerformanceId: original.servicePerformanceId,
              appointmentId: original.appointmentId,
              clinicalServiceId: original.clinicalServiceId,
              snapshotRevisionId: original.snapshotRevisionId,
              invoiceId: original.invoiceId,
              invoiceLineId: original.invoiceLineId,
              paymentId: original.paymentId,
              refundId: null,
              correctionEventId,
              packageAllocationId: original.packageAllocationId,
              commissionPlanVersionId: original.commissionPlanVersionId,
              calculationBasis: original.calculationBasis,
              attributedRevenueAmount: reverseAttributed,
              commissionPercent: original.commissionPercent,
              commissionAmount: reverseAmount,
              currency: original.currency,
              status: CommissionAccrualStatus.REVERSED,
              earnedAt: new Date(),
              reversalOfAccrualId: original.id,
              idempotencyKey,
              reason: input.reason?.trim() || null,
              createdBy: actorId,
            },
          }),
        );

        await this.audit.recordInTransaction(tx, {
          tenantId,
          actorId,
          actorRoles,
          action: 'staff_commission.accrual.reversed',
          resourceId: reversal.id,
          descriptionEn: 'Commission accrual reversed for correction (full remaining)',
          details: {
            reversalOfAccrualId: original.id,
            correctionEventId,
            commissionAmount: reverseAmount.toString(),
            attributedRevenueAmount: reverseAttributed.toString(),
          },
        });

        return reversal;
      } catch (err) {
        if (!isUniqueConflict(err)) throw err;
        const existing = await tx.commissionAccrual.findFirst({
          where: { tenantId, idempotencyKey },
        });
        if (!existing) throw err;
        return existing;
      }
    };

    if (externalTx) return run(externalTx);
    return this.prisma.withPlatformBypass(run);
  }

  async settleAccrual(
    input: {
      accrualId: string;
      settlementReference: string;
      amount?: string | number | null;
      actor: string | WaveFActor;
      actorRoles?: string[];
    },
    externalTx?: Prisma.TransactionClient,
  ) {
    const tenantId = await this.requireTenant();
    const { actorId, actorRoles } = this.normalizeActor(input.actor, input.actorRoles);
    const accrualId = assertUuid(input.accrualId, 'accrualId');
    const settlementReference = String(input.settlementReference ?? '').trim();
    if (!settlementReference) {
      throw new BadRequestException('settlementReference is required');
    }
    if (settlementReference.length > 255) {
      throw new BadRequestException('settlementReference max length is 255');
    }
    const idempotencyKey = `settle:${accrualId}:${settlementReference}`;

    const run = async (tx: Prisma.TransactionClient) => {
      // R9-C — identity lookup, then SP (+ package) before accrual lock.
      const identity = await tx.commissionAccrual.findFirst({
        where: { id: accrualId, tenantId },
        select: {
          id: true,
          servicePerformanceId: true,
          packageAllocationId: true,
        },
      });
      if (!identity) throw new NotFoundException('Commission accrual not found');
      await this.lockCrossBasisEconomicScope(tx, tenantId, identity.servicePerformanceId);
      if (identity.packageAllocationId) {
        await this.lockPackageAllocationScope(tx, tenantId, identity.packageAllocationId);
      }
      await tx.$queryRaw`
        SELECT id FROM "commission_accruals"
        WHERE id = ${accrualId}::uuid AND "tenantId" = ${tenantId}::uuid
        FOR UPDATE
      `;

      const existingAlloc = await tx.commissionSettlementAllocation.findFirst({
        where: { tenantId, idempotencyKey },
      });
      if (existingAlloc) {
        const accrual = await tx.commissionAccrual.findFirst({
          where: { id: accrualId, tenantId },
        });
        if (!accrual) throw new NotFoundException('Commission accrual not found');
        return {
          ...accrual,
          settlementAllocation: existingAlloc,
          settleableAmount: '0.00',
          idempotent: true as const,
        };
      }

      const accrual = await tx.commissionAccrual.findFirst({
        where: { id: accrualId, tenantId },
      });
      if (!accrual) throw new NotFoundException('Commission accrual not found');
      assertNotSelfEdit(actorId, actorRoles, accrual.userId);
      if (accrual.reversalOfAccrualId) {
        throw new BadRequestException('Cannot settle a reversal accrual row');
      }
      if (
        accrual.status !== CommissionAccrualStatus.EARNED &&
        accrual.status !== CommissionAccrualStatus.SETTLED
      ) {
        throw new BadRequestException(
          `Only EARNED/SETTLED original accruals accept settlement allocations (was ${accrual.status})`,
        );
      }

      const reversals = await tx.commissionAccrual.findMany({
        where: {
          tenantId,
          reversalOfAccrualId: accrual.id,
          status: CommissionAccrualStatus.REVERSED,
        },
        select: { commissionAmount: true },
      });
      const reversedAbs = reversals.reduce(
        (acc, r) => acc.add(new Prisma.Decimal(r.commissionAmount).abs()),
        new Prisma.Decimal(0),
      );
      const priorSettlements = await tx.commissionSettlementAllocation.findMany({
        where: { tenantId, accrualId: accrual.id },
        select: { amount: true },
      });
      const settledAbs = priorSettlements.reduce(
        (acc, s) => acc.add(new Prisma.Decimal(s.amount)),
        new Prisma.Decimal(0),
      );
      const settleable = new Prisma.Decimal(accrual.commissionAmount)
        .sub(reversedAbs)
        .sub(settledAbs);
      if (settleable.lte(0)) {
        throw new BadRequestException(
          'No net settleable commission remains (fully reversed or already settled)',
        );
      }

      let allocate = settleable;
      if (input.amount != null && input.amount !== undefined && String(input.amount).trim() !== '') {
        const requested = new Prisma.Decimal(String(input.amount));
        if (requested.lte(0)) {
          throw new BadRequestException('settlement amount must be > 0');
        }
        if (requested.gt(settleable)) {
          throw new BadRequestException('settlement amount exceeds net settleable remaining');
        }
        allocate = roundMoney(requested);
      } else {
        allocate = roundMoney(settleable);
      }

      const allocation = await tx.commissionSettlementAllocation.create({
        data: {
          id: randomUUID(),
          tenantId,
          accrualId: accrual.id,
          amount: allocate,
          currency: accrual.currency,
          settlementReference,
          idempotencyKey,
          reason: null,
          createdBy: actorId,
        },
      });

      const fullySettled = allocate
        .add(settledAbs)
        .add(reversedAbs)
        .gte(new Prisma.Decimal(accrual.commissionAmount));
      let updated = accrual;
      if (accrual.status === CommissionAccrualStatus.EARNED && fullySettled) {
        updated = await tx.commissionAccrual.update({
          where: { id: accrual.id },
          data: {
            status: CommissionAccrualStatus.SETTLED,
            settledAt: new Date(),
            settlementReference,
          },
        });
      }

      await this.audit.recordInTransaction(tx, {
        tenantId,
        actorId,
        actorRoles,
        action: 'staff_commission.accrual.settled',
        resourceId: accrual.id,
        descriptionEn: 'Commission settlement allocation recorded',
        details: {
          settlementReference,
          allocationId: allocation.id,
          amount: allocation.amount.toString(),
          fullySettled,
        },
      });

      return {
        ...updated,
        settlementAllocation: allocation,
        settleableAmount: roundMoney(settleable).toFixed(2),
        idempotent: false as const,
      };
    };

    if (externalTx) return run(externalTx);
    return this.prisma.withPlatformBypass(run);
  }

  async getAccrual(accrualId: string) {
    const tenantId = await this.requireTenant();
    const id = assertUuid(accrualId, 'accrualId');
    const row = await this.prisma.withPlatformBypass((tx) =>
      tx.commissionAccrual.findFirst({ where: { id, tenantId } }),
    );
    if (!row) throw new NotFoundException('Commission accrual not found');
    return row;
  }

  async ownerReport(input: {
    userId?: string;
    branchId?: string;
    clinicalServiceId?: string;
    planVersionId?: string;
    from: string | Date;
    to: string | Date;
  }) {
    const tenantId = await this.requireTenant();
    const from = this.parseBound(input.from, 'from');
    const to = this.parseBound(input.to, 'to');
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('from must be <= to');
    }
    const userId = input.userId ? assertUuid(input.userId, 'userId') : undefined;
    const branchId = input.branchId ? assertUuid(input.branchId, 'branchId') : undefined;
    const clinicalServiceId = input.clinicalServiceId
      ? assertUuid(input.clinicalServiceId, 'clinicalServiceId')
      : undefined;
    const planVersionId = input.planVersionId
      ? assertUuid(input.planVersionId, 'planVersionId')
      : undefined;

    const rows = await this.prisma.withPlatformBypass((tx) =>
      tx.commissionAccrual.findMany({
        where: {
          tenantId,
          ...(userId ? { userId } : {}),
          ...(branchId ? { branchId } : {}),
          ...(clinicalServiceId ? { clinicalServiceId } : {}),
          ...(planVersionId ? { commissionPlanVersionId: planVersionId } : {}),
          createdAt: { gte: from, lte: to },
        },
        select: {
          id: true,
          userId: true,
          branchId: true,
          clinicalServiceId: true,
          commissionPlanVersionId: true,
          servicePerformanceId: true,
          snapshotRevisionId: true,
          appointmentId: true,
          invoiceId: true,
          invoiceLineId: true,
          refundId: true,
          status: true,
          commissionAmount: true,
          attributedRevenueAmount: true,
          currency: true,
          reversalOfAccrualId: true,
        },
      }),
    );

    const settlements = await this.prisma.withPlatformBypass((tx) =>
      tx.commissionSettlementAllocation.findMany({
        where: {
          tenantId,
          accrualId: { in: rows.filter((r) => !r.reversalOfAccrualId).map((r) => r.id) },
        },
        select: {
          id: true,
          accrualId: true,
          amount: true,
          currency: true,
          settlementReference: true,
        },
      }),
    );
    const settledByAccrual = new Map<string, Prisma.Decimal>();
    const settlementRefsByAccrual = new Map<
      string,
      Array<{ allocationId: string; amount: string; settlementReference: string }>
    >();
    for (const s of settlements) {
      settledByAccrual.set(
        s.accrualId,
        (settledByAccrual.get(s.accrualId) ?? new Prisma.Decimal(0)).add(s.amount),
      );
      const list = settlementRefsByAccrual.get(s.accrualId) ?? [];
      list.push({
        allocationId: s.id,
        amount: new Prisma.Decimal(s.amount).toFixed(2),
        settlementReference: s.settlementReference,
      });
      settlementRefsByAccrual.set(s.accrualId, list);
    }

    const lineIds = [
      ...new Set(
        rows
          .map((r) => r.invoiceLineId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ];
    const inventoryUsages = lineIds.length
      ? await this.prisma.withPlatformBypass((tx) =>
          tx.inventoryUsageLedger.findMany({
            where: { tenantId, invoiceLineItemId: { in: lineIds } },
            select: {
              id: true,
              invoiceLineItemId: true,
              inventoryBatchId: true,
              quantityUsed: true,
            },
          }),
        )
      : [];
    const inventoryByLine = new Map<
      string,
      Array<{ usageId: string; batchId: string | null; quantity: string }>
    >();
    for (const u of inventoryUsages) {
      if (!u.invoiceLineItemId) continue;
      const list = inventoryByLine.get(u.invoiceLineItemId) ?? [];
      list.push({
        usageId: u.id,
        batchId: u.inventoryBatchId ?? null,
        quantity: String(u.quantityUsed),
      });
      inventoryByLine.set(u.invoiceLineItemId, list);
    }

    type Bucket = {
      attributedRevenue: Prisma.Decimal;
      earned: Prisma.Decimal;
      settled: Prisma.Decimal;
      reversed: Prisma.Decimal;
      outstanding: Prisma.Decimal;
      rowCount: number;
    };
    const byCurrencyMap = new Map<string, Bucket>();
    const zero = () => new Prisma.Decimal(0);
    const bucket = (currency: string): Bucket => {
      let b = byCurrencyMap.get(currency);
      if (!b) {
        b = {
          attributedRevenue: zero(),
          earned: zero(),
          settled: zero(),
          reversed: zero(),
          outstanding: zero(),
          rowCount: 0,
        };
        byCurrencyMap.set(currency, b);
      }
      return b;
    };

    const originals = rows.filter((r) => !r.reversalOfAccrualId);
    const reversals = rows.filter((r) => r.reversalOfAccrualId);
    const reversalsByParent = new Map<
      string,
      { commission: Prisma.Decimal; revenue: Prisma.Decimal; reversalIds: string[] }
    >();
    for (const rev of reversals) {
      const parentId = rev.reversalOfAccrualId!;
      const absC = new Prisma.Decimal(rev.commissionAmount).abs();
      const absR = new Prisma.Decimal(rev.attributedRevenueAmount).abs();
      const cur = reversalsByParent.get(parentId) ?? {
        commission: zero(),
        revenue: zero(),
        reversalIds: [],
      };
      cur.commission = cur.commission.add(absC);
      cur.revenue = cur.revenue.add(absR);
      cur.reversalIds.push(rev.id);
      reversalsByParent.set(parentId, cur);
      const b = bucket(rev.currency);
      b.reversed = b.reversed.add(absC);
      b.rowCount += 1;
    }

    const drilldown: Array<Record<string, unknown>> = [];

    for (const row of originals) {
      const amt = new Prisma.Decimal(row.commissionAmount);
      const attr = new Prisma.Decimal(row.attributedRevenueAmount);
      const b = bucket(row.currency);
      b.rowCount += 1;
      b.earned = b.earned.add(amt);
      b.attributedRevenue = b.attributedRevenue.add(attr);
      const rev = reversalsByParent.get(row.id) ?? {
        commission: zero(),
        revenue: zero(),
        reversalIds: [],
      };
      const settled = settledByAccrual.get(row.id) ?? zero();
      b.settled = b.settled.add(settled);
      const outstanding = amt.sub(rev.commission).sub(settled);
      b.outstanding = b.outstanding.add(outstanding.lt(0) ? zero() : outstanding);
      const inventory =
        row.invoiceLineId != null ? (inventoryByLine.get(row.invoiceLineId) ?? []) : [];
      drilldown.push({
        accrualId: row.id,
        userId: row.userId,
        branchId: row.branchId,
        clinicalServiceId: row.clinicalServiceId,
        planVersionId: row.commissionPlanVersionId,
        servicePerformanceId: row.servicePerformanceId,
        snapshotRevisionId: row.snapshotRevisionId,
        appointmentId: row.appointmentId,
        invoiceId: row.invoiceId,
        invoiceLineId: row.invoiceLineId,
        refundId: row.refundId,
        currency: row.currency,
        attributedRevenue: attr.toFixed(2),
        earned: amt.toFixed(2),
        reversed: rev.commission.toFixed(2),
        settled: settled.toFixed(2),
        outstanding: (outstanding.lt(0) ? zero() : outstanding).toFixed(2),
        reversalIds: rev.reversalIds,
        settlementAllocations: settlementRefsByAccrual.get(row.id) ?? [],
        inventoryUsages: inventory,
      });
    }

    const byCurrency = [...byCurrencyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, b]) => {
        const net = b.earned.sub(b.reversed);
        return {
          currency,
          attributedRevenue: b.attributedRevenue.toFixed(2),
          earned: b.earned.toFixed(2),
          settled: b.settled.toFixed(2),
          outstanding: b.outstanding.toFixed(2),
          reversed: b.reversed.toFixed(2),
          net: (net.lt(0) ? zero() : net).toFixed(2),
          rowCount: b.rowCount,
        };
      });

    // Dimension rollups (per currency nested — never cross-sum currencies).
    const dimKey = (parts: Array<string | null | undefined>) => parts.map((p) => p ?? '_').join('|');
    const rollup = (
      keyFn: (r: (typeof originals)[number]) => string,
    ): Array<{ key: string; byCurrency: typeof byCurrency }> => {
      const groups = new Map<string, typeof originals>();
      for (const r of originals) {
        const k = keyFn(r);
        const arr = groups.get(k) ?? [];
        arr.push(r);
        groups.set(k, arr);
      }
      return [...groups.entries()].map(([key, groupRows]) => {
        const local = new Map<string, Bucket>();
        const bkt = (c: string) => {
          let b = local.get(c);
          if (!b) {
            b = {
              attributedRevenue: zero(),
              earned: zero(),
              settled: zero(),
              reversed: zero(),
              outstanding: zero(),
              rowCount: 0,
            };
            local.set(c, b);
          }
          return b;
        };
        for (const row of groupRows) {
          const amt = new Prisma.Decimal(row.commissionAmount);
          const attr = new Prisma.Decimal(row.attributedRevenueAmount);
          const b = bkt(row.currency);
          b.earned = b.earned.add(amt);
          b.attributedRevenue = b.attributedRevenue.add(attr);
          b.rowCount += 1;
          const rev = reversalsByParent.get(row.id) ?? {
            commission: zero(),
            revenue: zero(),
            reversalIds: [] as string[],
          };
          const settled = settledByAccrual.get(row.id) ?? zero();
          b.reversed = b.reversed.add(rev.commission);
          b.settled = b.settled.add(settled);
          const outstanding = amt.sub(rev.commission).sub(settled);
          b.outstanding = b.outstanding.add(outstanding.lt(0) ? zero() : outstanding);
        }
        return {
          key,
          byCurrency: [...local.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([currency, b]) => {
              const net = b.earned.sub(b.reversed);
              return {
                currency,
                attributedRevenue: b.attributedRevenue.toFixed(2),
                earned: b.earned.toFixed(2),
                settled: b.settled.toFixed(2),
                outstanding: b.outstanding.toFixed(2),
                reversed: b.reversed.toFixed(2),
                net: (net.lt(0) ? zero() : net).toFixed(2),
                rowCount: b.rowCount,
              };
            }),
        };
      });
    };

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      filters: {
        userId: userId ?? null,
        branchId: branchId ?? null,
        clinicalServiceId: clinicalServiceId ?? null,
        planVersionId: planVersionId ?? null,
      },
      byCurrency,
      byUser: rollup((r) => dimKey([r.userId])),
      byBranch: rollup((r) => dimKey([r.branchId])),
      byClinicalService: rollup((r) => dimKey([r.clinicalServiceId])),
      byPlanVersion: rollup((r) => dimKey([r.commissionPlanVersionId])),
      drilldown,
      rowCount: rows.length,
      legacyCommissionCalculationIncluded: false,
    };
  }

  /** R7-B — both invoice-based and collected paths lock the same performance row first. */
  private async lockCrossBasisEconomicScope(
    tx: Prisma.TransactionClient,
    tenantId: string,
    performanceId: string,
  ): Promise<void> {
    await tx.$queryRaw`
      SELECT id FROM "service_performances"
      WHERE id = ${performanceId}::uuid AND "tenantId" = ${tenantId}::uuid AND "deletedAt" IS NULL
      FOR UPDATE
    `;
  }

  /** R7-B — serialize package allocation economic decisions after resolve. */
  private async lockPackageAllocationScope(
    tx: Prisma.TransactionClient,
    tenantId: string,
    packageAllocationId: string,
  ): Promise<void> {
    await tx.$queryRaw`
      SELECT id FROM "commission_package_session_allocations"
      WHERE id = ${packageAllocationId}::uuid AND "tenantId" = ${tenantId}::uuid
      FOR UPDATE
    `;
  }

  private async packageAttributedRevenueAbs(
    tx: Prisma.TransactionClient,
    tenantId: string,
    packageAllocationId: string,
  ): Promise<Prisma.Decimal> {
    const earns = await tx.commissionAccrual.findMany({
      where: {
        tenantId,
        packageAllocationId,
        reversalOfAccrualId: null,
        status: { in: [CommissionAccrualStatus.EARNED, CommissionAccrualStatus.SETTLED] },
      },
      select: { id: true, attributedRevenueAmount: true },
    });
    let total = new Prisma.Decimal(0);
    for (const earn of earns) {
      const reversals = await tx.commissionAccrual.findMany({
        where: {
          tenantId,
          reversalOfAccrualId: earn.id,
          status: CommissionAccrualStatus.REVERSED,
        },
        select: { attributedRevenueAmount: true },
      });
      const reversed = reversals.reduce(
        (acc, r) => acc.add(new Prisma.Decimal(r.attributedRevenueAmount).abs()),
        new Prisma.Decimal(0),
      );
      total = total.add(new Prisma.Decimal(earn.attributedRevenueAmount).sub(reversed));
    }
    return total.lt(0) ? new Prisma.Decimal(0) : total;
  }

  private async remainingCommissionAbs(
    tx: Prisma.TransactionClient,
    tenantId: string,
    accrualId: string,
    originalAmount: Prisma.Decimal.Value,
  ): Promise<Prisma.Decimal> {
    const reversals = await tx.commissionAccrual.findMany({
      where: {
        tenantId,
        reversalOfAccrualId: accrualId,
        status: CommissionAccrualStatus.REVERSED,
      },
      select: { commissionAmount: true },
    });
    const reversed = reversals.reduce(
      (acc, r) => acc.add(new Prisma.Decimal(r.commissionAmount).abs()),
      new Prisma.Decimal(0),
    );
    return new Prisma.Decimal(originalAmount).sub(reversed);
  }

  private async resolvePackageAllocationForPost(
    tx: Prisma.TransactionClient,
    tenantId: string,
    performanceId: string,
    line: {
      id: string;
      courseSessionId: string | null;
      appointmentId?: string | null;
      clinicalServiceId?: string | null;
      performanceBindingStatus?: string | null;
      servicePerformanceId?: string | null;
      invoice: {
        tenantId: string;
        patientId: string;
        currency: string;
        branchId?: string | null;
      };
    },
  ): Promise<{
    id: string;
    allocatedRevenueAmount: Prisma.Decimal;
    currency: string;
    invoiceLineId: string | null;
    financiallyConsumedAt: Date | null;
  } | null> {
    let courseContext = Boolean(line.courseSessionId);
    if (!courseContext && line.appointmentId) {
      const session = await tx.courseSession.findFirst({
        where: { appointmentId: line.appointmentId },
        select: { id: true },
      });
      courseContext = Boolean(session);
    }
    if (!courseContext) {
      const perf = await tx.servicePerformance.findFirst({
        where: { id: performanceId, tenantId },
        select: { appointmentId: true },
      });
      if (perf?.appointmentId) {
        const session = await tx.courseSession.findFirst({
          where: { appointmentId: perf.appointmentId },
          select: { id: true },
        });
        courseContext = Boolean(session);
      }
    }

    const allocation = await tx.commissionPackageSessionAllocation.findFirst({
      where: { tenantId, servicePerformanceId: performanceId },
    });

    if (courseContext && !allocation) {
      throw new BadRequestException(
        'Course/package performance requires explicit commission_package_session_allocations before accrual',
      );
    }
    if (!allocation) return null;

    // R7-C — when allocation.invoiceLineId is set, enforce same-line on EVERY post
    // (consumed or not). Different line only via proven correction lineage.
    if (allocation.invoiceLineId && allocation.invoiceLineId !== line.id) {
      const priorLine = await tx.invoiceLineItem.findFirst({
        where: { id: allocation.invoiceLineId, tenantId },
        include: {
          invoice: {
            select: {
              tenantId: true,
              patientId: true,
              currency: true,
              branchId: true,
            },
          },
        },
      });
      if (!priorLine || priorLine.invoice.tenantId !== tenantId) {
        throw new BadRequestException(
          'Package allocation invoiceLineId does not resolve for tenant; fail-closed',
        );
      }
      const priorSuperseded =
        priorLine.performanceBindingStatus === 'SUPERSEDED' &&
        priorLine.servicePerformanceId === performanceId;
      const replacementActive =
        (line.performanceBindingStatus === 'ACTIVE' ||
          line.servicePerformanceId === performanceId) &&
        (line.servicePerformanceId == null || line.servicePerformanceId === performanceId);
      const sameCourseSession =
        (!priorLine.courseSessionId && !line.courseSessionId) ||
        priorLine.courseSessionId === line.courseSessionId;
      const samePatient = priorLine.invoice.patientId === line.invoice.patientId;
      const sameCurrency =
        String(priorLine.invoice.currency ?? '')
          .trim()
          .toUpperCase() ===
        String(line.invoice.currency ?? '')
          .trim()
          .toUpperCase();
      const sameClinical =
        !priorLine.clinicalServiceId ||
        !line.clinicalServiceId ||
        priorLine.clinicalServiceId === line.clinicalServiceId;
      const sameAppointment =
        !priorLine.appointmentId ||
        !line.appointmentId ||
        priorLine.appointmentId === line.appointmentId;

      if (
        !(
          priorSuperseded &&
          replacementActive &&
          sameCourseSession &&
          samePatient &&
          sameCurrency &&
          sameClinical &&
          sameAppointment
        )
      ) {
        throw new BadRequestException(
          'Package allocation is pinned to a different invoice line; posting against another line requires proven correction lineage',
        );
      }
      // Valid correction lineage: reuse same allocation identity; do not rewrite invoiceLineId.
    }
    return allocation;
  }

  private basisAmount(
    basis: CommissionCalculationBasis,
    line: {
      subtotal: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      lineTotal: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
    },
  ): Prisma.Decimal {
    switch (basis) {
      case CommissionCalculationBasis.SERVICE_GROSS:
        return new Prisma.Decimal(line.subtotal);
      case CommissionCalculationBasis.SERVICE_NET_AFTER_DISCOUNT:
        return new Prisma.Decimal(line.subtotal).sub(line.discountAmount);
      case CommissionCalculationBasis.SERVICE_NET_EXCLUDING_TAX:
        return new Prisma.Decimal(line.lineTotal).sub(line.taxAmount);
      case CommissionCalculationBasis.COLLECTED_REVENUE:
        throw new BadRequestException(
          'COLLECTED_REVENUE accruals are not posted via service-performance path',
        );
      default:
        throw new BadRequestException(`Unsupported calculationBasis: ${basis}`);
    }
  }

  private resolveAttributionShares(
    participants: Array<{
      userId: string;
      role: ServicePerformanceParticipantRole;
      attributionShare: Prisma.Decimal | null;
    }>,
  ): Prisma.Decimal[] {
    if (participants.length === 1) {
      const only = participants[0]!;
      if (only.attributionShare == null) {
        if (only.role !== ServicePerformanceParticipantRole.PRIMARY) {
          throw new BadRequestException(
            'Single participant with null attributionShare must have PRIMARY role',
          );
        }
        return [new Prisma.Decimal(100)];
      }
      return [new Prisma.Decimal(only.attributionShare)];
    }

    const shares: Prisma.Decimal[] = [];
    for (const p of participants) {
      if (p.attributionShare == null) {
        throw new BadRequestException(
          'Missing attributionShare for multi-participant commission attribution',
        );
      }
      shares.push(new Prisma.Decimal(p.attributionShare));
    }
    return shares;
  }

  private normalizeActor(
    actor: string | WaveFActor,
    actorRoles?: string[],
  ): { actorId: string; actorRoles: string[] } {
    if (typeof actor === 'string') {
      const actorId = actor?.trim();
      if (!actorId) throw new BadRequestException('Authenticated actor is required');
      return { actorId, actorRoles: actorRoles ?? [] };
    }
    const actorId = actor?.actorId?.trim();
    if (!actorId) throw new BadRequestException('Authenticated actor is required');
    return { actorId, actorRoles: actor.actorRoles ?? actorRoles ?? [] };
  }

  private parseBound(value: string | Date, field: string): Date {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        throw new BadRequestException(`${field} must be a valid date`);
      }
      return value;
    }
    const d = new Date(String(value).trim());
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(`${field} must be a valid ISO datetime`);
    }
    return d;
  }

  private async requireTenant(): Promise<string> {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    return tenantId;
  }
}
