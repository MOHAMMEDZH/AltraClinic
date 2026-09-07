import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ServicePerformanceStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { assertUuid } from '../../dental/services/wave-d-reference.validation';
import { WAVE_F_AUDIT_LOG, WaveFAuditLog } from '../ports/wave-f-audit-log.port';
import { WaveFActor } from './staff-commission-plan.service';
import { assertTwoWayInvoiceLinePerformanceProvenance } from './invoice-line-performance-provenance';

/**
 * Wave F Round 3/4/6 — server-authoritative ServicePerformance ↔ InvoiceLine binding.
 * Does not use encounterMatch / serviceCodeMatch heuristics.
 * Round 6: shares canonical two-way provenance validator with correction binding.
 */
export async function resolveAuthoritativeServicePerformanceForAppointment(
  tx: Prisma.TransactionClient,
  opts: {
    tenantId: string;
    appointmentId: string;
    snapshotRevisionId?: string | null;
    clinicalServiceId?: string | null;
  },
): Promise<string | null> {
  const performances = await tx.servicePerformance.findMany({
    where: {
      tenantId: opts.tenantId,
      appointmentId: opts.appointmentId,
      status: ServicePerformanceStatus.COMPLETED,
      deletedAt: null,
    },
    select: {
      id: true,
      clinicalServiceId: true,
      snapshotRevisionId: true,
    },
    orderBy: { performedAt: 'asc' },
  });

  if (performances.length === 0) {
    return null;
  }

  if (opts.snapshotRevisionId) {
    const bySnap = performances.filter((p) => p.snapshotRevisionId === opts.snapshotRevisionId);
    if (bySnap.length === 1) return bySnap[0].id;
    if (bySnap.length > 1) {
      throw new BadRequestException(
        'Ambiguous ServicePerformance for appointment invoice (multiple COMPLETED rows share snapshotRevisionId)',
      );
    }
  }

  if (opts.clinicalServiceId) {
    const bySvc = performances.filter((p) => p.clinicalServiceId === opts.clinicalServiceId);
    if (bySvc.length === 1) return bySvc[0].id;
    if (bySvc.length > 1) {
      throw new BadRequestException(
        'Ambiguous ServicePerformance for appointment invoice (multiple COMPLETED rows share clinicalServiceId)',
      );
    }
  }

  if (performances.length === 1) {
    return performances[0].id;
  }

  throw new BadRequestException(
    'Ambiguous ServicePerformance for appointment invoice; complete durable attribution before billing or bind after',
  );
}

@Injectable()
export class InvoiceLinePerformanceAttributionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(WAVE_F_AUDIT_LOG) private readonly audit: WaveFAuditLog,
  ) {}

  /**
   * Durable later-binding when invoice line was created before ServicePerformance.
   * Client may nominate a performance id; server validates all frozen relationships.
   * Round 4: same patient+branch alone is insufficient — appointment/service/snapshot provenance required.
   */
  async bindInvoiceLine(input: {
    invoiceLineId: string;
    servicePerformanceId: string;
    actor: WaveFActor;
  }) {
    const tenantId = await this.requireTenant();
    const invoiceLineId = assertUuid(input.invoiceLineId, 'invoiceLineId');
    const servicePerformanceId = assertUuid(
      input.servicePerformanceId,
      'servicePerformanceId',
    );
    if (!input.actor?.actorId?.trim()) {
      throw new BadRequestException('Authenticated actor is required');
    }

    return this.prisma.withPlatformBypass(async (tx) => {
      const line = await tx.invoiceLineItem.findFirst({
        where: { id: invoiceLineId, tenantId },
        include: {
          invoice: {
            select: {
              id: true,
              tenantId: true,
              patientId: true,
              branchId: true,
            },
          },
        },
      });
      if (!line || line.invoice.tenantId !== tenantId) {
        throw new NotFoundException('Invoice line not found for tenant');
      }

      if (line.servicePerformanceId) {
        if (
          line.servicePerformanceId === servicePerformanceId &&
          line.performanceBindingStatus === 'ACTIVE'
        ) {
          return {
            invoiceLineId,
            servicePerformanceId,
            idempotent: true as const,
          };
        }
        throw new BadRequestException(
          'Invoice line already bound to a different ServicePerformance; reassignment forbidden',
        );
      }

      const performance = await tx.servicePerformance.findFirst({
        where: { id: servicePerformanceId, tenantId, deletedAt: null },
      });
      if (!performance) {
        throw new NotFoundException('Service performance not found');
      }
      if (performance.status !== ServicePerformanceStatus.COMPLETED) {
        throw new BadRequestException(
          `Service performance must be COMPLETED to bind invoice line (was ${performance.status})`,
        );
      }

      // Round 6 — canonical two-way provenance (shared with correction binding).
      await assertTwoWayInvoiceLinePerformanceProvenance(tx, tenantId, line, performance, {
        patientId: line.invoice.patientId,
        branchId: line.invoice.branchId,
      });

      const otherLine = await tx.invoiceLineItem.findFirst({
        where: {
          tenantId,
          servicePerformanceId,
          performanceBindingStatus: 'ACTIVE',
          NOT: { id: invoiceLineId },
        },
        select: { id: true },
      });
      if (otherLine) {
        throw new BadRequestException(
          'ServicePerformance already bound to a different ACTIVE invoice line',
        );
      }

      try {
        const updated = await tx.invoiceLineItem.update({
          where: { id: invoiceLineId },
          data: {
            servicePerformanceId,
            performanceBindingStatus: 'ACTIVE',
          },
        });

        await this.audit.recordInTransaction(tx, {
          tenantId,
          actorId: input.actor.actorId,
          actorRoles: input.actor.actorRoles,
          action: 'staff_commission.invoice_line.performance_bound',
          resourceId: invoiceLineId,
          descriptionEn: 'Invoice line bound to authoritative ServicePerformance',
          details: {
            servicePerformanceId,
            invoiceId: line.invoiceId,
            appointmentId: performance.appointmentId,
            clinicalServiceId: performance.clinicalServiceId,
            snapshotRevisionId: performance.snapshotRevisionId,
            encounterId: performance.encounterId,
          },
        });

        return {
          invoiceLineId: updated.id,
          servicePerformanceId: updated.servicePerformanceId,
          idempotent: false as const,
        };
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          throw new BadRequestException(
            'ServicePerformance already bound to a different invoice line',
          );
        }
        throw err;
      }
    });
  }

  private async requireTenant(): Promise<string> {
    const tenant = await this.tenantContext.resolve();
    const tenantId = tenant.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    return tenantId;
  }
}
