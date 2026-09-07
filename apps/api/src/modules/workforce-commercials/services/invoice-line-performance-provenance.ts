import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Wave F Round 5/6 — canonical two-way InvoiceLineItem ↔ ServicePerformance provenance.
 * Used by bind-performance, correction replacement binding, and accrual linkage.
 */
export function requireMatchTwoWay(
  label: string,
  lineValue: string | null | undefined,
  performanceValue: string | null | undefined,
): void {
  if (lineValue != null) {
    if (performanceValue == null) {
      throw new BadRequestException(
        `ServicePerformance lacks durable ${label} required to match invoice line provenance`,
      );
    }
    if (performanceValue !== lineValue) {
      throw new BadRequestException(
        `Invoice line ${label} must match ServicePerformance.${label} for binding`,
      );
    }
    return;
  }
  if (performanceValue != null) {
    throw new BadRequestException(
      `Invoice line lacks durable ${label} required to prove ServicePerformance binding`,
    );
  }
}

export type ProvenanceLine = {
  id?: string;
  appointmentId?: string | null;
  clinicalServiceId?: string | null;
  snapshotRevisionId?: string | null;
  encounterId?: string | null;
  courseSessionId?: string | null;
};

export type ProvenancePerformance = {
  id: string;
  appointmentId?: string | null;
  clinicalServiceId?: string | null;
  snapshotRevisionId?: string | null;
  encounterId?: string | null;
  patientId?: string | null;
  branchId?: string | null;
};

export type ProvenanceInvoice = {
  patientId: string;
  branchId?: string | null;
};

/**
 * Canonical server-side provenance validator (Round 6 single SoR for binding rules).
 * @param opts.requireDurableContext — bind/correction require ≥1 durable field; accrual may omit when servicePerformanceId already proves link.
 */
export async function assertTwoWayInvoiceLinePerformanceProvenance(
  tx: Prisma.TransactionClient,
  tenantId: string,
  line: ProvenanceLine,
  performance: ProvenancePerformance,
  invoice?: ProvenanceInvoice | null,
  opts?: { requireDurableContext?: boolean },
): Promise<void> {
  if (invoice) {
    if (performance.patientId && performance.patientId !== invoice.patientId) {
      throw new BadRequestException('ServicePerformance patientId must match invoice patientId');
    }
    if (
      performance.branchId &&
      invoice.branchId &&
      performance.branchId !== invoice.branchId
    ) {
      throw new BadRequestException('ServicePerformance branchId must match invoice branchId');
    }
  }

  requireMatchTwoWay('appointmentId', line.appointmentId, performance.appointmentId);
  requireMatchTwoWay('clinicalServiceId', line.clinicalServiceId, performance.clinicalServiceId);
  requireMatchTwoWay('snapshotRevisionId', line.snapshotRevisionId, performance.snapshotRevisionId);
  requireMatchTwoWay('encounterId', line.encounterId, performance.encounterId);

  if (line.courseSessionId) {
    const session = await tx.courseSession.findFirst({
      where: { id: line.courseSessionId, tenantId, deletedAt: null },
      select: { id: true, appointmentId: true, courseId: true },
    });
    if (!session) {
      throw new BadRequestException(
        'Invoice line courseSessionId does not resolve for tenant; binding fail-closed',
      );
    }
    if (!performance.appointmentId) {
      throw new BadRequestException(
        'ServicePerformance lacks appointmentId required to prove courseSession provenance',
      );
    }
    if (!session.appointmentId || session.appointmentId !== performance.appointmentId) {
      throw new BadRequestException(
        'Invoice line courseSessionId cannot be proven against ServicePerformance appointment',
      );
    }
  } else if (performance.appointmentId) {
    const perfSession = await tx.courseSession.findFirst({
      where: { appointmentId: performance.appointmentId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (perfSession) {
      throw new BadRequestException(
        'Invoice line lacks courseSessionId required to prove ServicePerformance course session provenance',
      );
    }
  }

  if (opts?.requireDurableContext !== false) {
    if (
      !line.appointmentId &&
      !line.encounterId &&
      !line.clinicalServiceId &&
      !line.snapshotRevisionId &&
      !line.courseSessionId
    ) {
      throw new BadRequestException(
        'Invoice line lacks durable provenance (appointment/encounter/service/snapshot/courseSession); binding fail-closed',
      );
    }
  }
}
