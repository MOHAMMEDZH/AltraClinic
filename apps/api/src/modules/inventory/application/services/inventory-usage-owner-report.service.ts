import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';

export interface OwnerReportFilter {
  tenantId: string;
  from?: Date;
  to?: Date;
  usageType?: string;
  usedByUserId?: string;
  inventoryItemId?: string;
  inventoryBatchId?: string;
  warehouseId?: string;
  branchId?: string;
  clinicalServiceId?: string;
  includePhi?: boolean;
  /** True only when caller holds api.patients / view (or equivalent custom grant). */
  hasPhiPermission: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Net quantity contribution for owner reporting (AR-20).
 *
 * Semantics:
 * - POSTED consumption / correction / wastage / etc. → +quantity
 * - REVERSED originals → 0 (replaced by reversal and/or correction rows)
 * - REVERSAL rows → 0 (they neutralize the original; do not subtract again)
 *
 * Case: usage 5 → net 5
 * Case: usage 5 + full reverse → net 0
 * Case: usage 5 + correct to 3 → net 3
 */
export function signedUsageQuantity(row: {
  quantityUsed: number;
  usageType: string;
  status: string;
}): number {
  if (row.status === 'REVERSED') return 0;
  if (row.usageType === 'REVERSAL') return 0;
  return Math.abs(row.quantityUsed);
}

/**
 * Owner-facing inventory usage aggregates (Wave C AR-20).
 * Filters and groupings match declared dimensions; PHI only with elevated permission.
 * Aggregates report net quantity (reversals/corrections handled correctly).
 */
@Injectable()
export class InventoryUsageOwnerReportService {
  constructor(private readonly prisma: PrismaService) {}

  async report(filter: OwnerReportFilter) {
    if (!filter.tenantId?.trim()) throw new BadRequestException('tenantId is required');
    if (filter.includePhi && !filter.hasPhiPermission) {
      throw new ForbiddenException('api.patients view permission required for PHI fields');
    }

    if (filter.limit != null && (!Number.isInteger(filter.limit) || filter.limit < 1 || filter.limit > 200)) {
      throw new BadRequestException('limit must be an integer between 1 and 200');
    }
    if (filter.offset != null && (!Number.isInteger(filter.offset) || filter.offset < 0)) {
      throw new BadRequestException('offset must be an integer >= 0');
    }
    if (filter.from && Number.isNaN(filter.from.getTime())) {
      throw new BadRequestException('from must be a valid date');
    }
    if (filter.to && Number.isNaN(filter.to.getTime())) {
      throw new BadRequestException('to must be a valid date');
    }
    if (filter.from && filter.to && filter.from.getTime() > filter.to.getTime()) {
      throw new BadRequestException('from must be less than or equal to to');
    }

    const uuidFields: Array<[string, string | undefined]> = [
      ['usedByUserId', filter.usedByUserId],
      ['inventoryItemId', filter.inventoryItemId],
      ['inventoryBatchId', filter.inventoryBatchId],
      ['warehouseId', filter.warehouseId],
      ['branchId', filter.branchId],
      ['clinicalServiceId', filter.clinicalServiceId],
    ];
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (const [name, value] of uuidFields) {
      if (value && !uuidRe.test(value)) {
        throw new BadRequestException(`${name} must be a valid UUID`);
      }
    }

    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    const where: Prisma.InventoryUsageLedgerWhereInput = {
      tenantId: filter.tenantId,
      ...(filter.usageType ? { usageType: filter.usageType } : {}),
      ...(filter.usedByUserId ? { usedByUserId: filter.usedByUserId } : {}),
      ...(filter.inventoryItemId ? { inventoryItemId: filter.inventoryItemId } : {}),
      ...(filter.inventoryBatchId ? { inventoryBatchId: filter.inventoryBatchId } : {}),
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
      ...(filter.branchId ? { branchId: filter.branchId } : {}),
      ...(filter.clinicalServiceId ? { clinicalServiceId: filter.clinicalServiceId } : {}),
      ...(filter.from || filter.to
        ? {
            occurredAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
    };

    const [rows, total, aggregateRows] = await Promise.all([
      this.prisma.inventoryUsageLedger.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          inventoryItemId: true,
          inventoryBatchId: true,
          quantityUsed: true,
          unit: true,
          usageType: true,
          usedByUserId: true,
          recordedByUserId: true,
          warehouseId: true,
          branchId: true,
          status: true,
          attributionStatus: true,
          occurredAt: true,
          reasonCode: true,
          patientId: filter.includePhi,
          appointmentId: filter.includePhi,
          clinicalServiceId: true,
        },
      }),
      this.prisma.inventoryUsageLedger.count({ where }),
      this.prisma.inventoryUsageLedger.findMany({
        where,
        select: {
          quantityUsed: true,
          usageType: true,
          status: true,
          usedByUserId: true,
        },
      }),
    ]);

    const byUsageTypeMap = new Map<string, { count: number; quantitySum: number }>();
    const byUsedByMap = new Map<string | null, { count: number; quantitySum: number }>();
    let netQuantityTotal = 0;

    for (const r of aggregateRows) {
      const qty = Number(r.quantityUsed);
      const signed = signedUsageQuantity({
        quantityUsed: qty,
        usageType: r.usageType,
        status: r.status,
      });
      netQuantityTotal += signed;

      const typeAgg = byUsageTypeMap.get(r.usageType) ?? { count: 0, quantitySum: 0 };
      typeAgg.count += 1;
      typeAgg.quantitySum += signed;
      byUsageTypeMap.set(r.usageType, typeAgg);

      const usedKey = r.usedByUserId;
      const usedAgg = byUsedByMap.get(usedKey) ?? { count: 0, quantitySum: 0 };
      usedAgg.count += 1;
      usedAgg.quantitySum += signed;
      byUsedByMap.set(usedKey, usedAgg);
    }

    return {
      total,
      limit,
      offset,
      aggregates: {
        netQuantityTotal,
        byUsageType: [...byUsageTypeMap.entries()].map(([usageType, a]) => ({
          usageType,
          count: a.count,
          quantitySum: a.quantitySum,
        })),
        byUsedBy: [...byUsedByMap.entries()].map(([usedByUserId, a]) => ({
          usedByUserId,
          count: a.count,
          quantitySum: a.quantitySum,
        })),
      },
      rows: rows.map((r) => {
        const quantityUsed = r.quantityUsed.toNumber();
        return {
          id: r.id,
          inventoryItemId: r.inventoryItemId,
          inventoryBatchId: r.inventoryBatchId,
          quantityUsed,
          signedQuantity: signedUsageQuantity({
            quantityUsed,
            usageType: r.usageType,
            status: r.status,
          }),
          unit: r.unit,
          usageType: r.usageType,
          usedByUserId: r.usedByUserId,
          recordedByUserId: r.recordedByUserId,
          warehouseId: r.warehouseId,
          branchId: r.branchId,
          status: r.status,
          attributionStatus: r.attributionStatus,
          occurredAt: r.occurredAt,
          reasonCode: r.reasonCode,
          clinicalServiceId: r.clinicalServiceId,
          ...(filter.includePhi
            ? {
                patientId: (r as { patientId?: string | null }).patientId ?? null,
                appointmentId: (r as { appointmentId?: string | null }).appointmentId ?? null,
              }
            : {}),
        };
      }),
    };
  }
}
