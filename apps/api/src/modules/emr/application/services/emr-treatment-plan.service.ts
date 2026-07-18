import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import type { EmrTreatmentPlanSummary } from '../../domain/emr.types';

@Injectable()
export class EmrTreatmentPlanService {
  constructor(private readonly prisma: PrismaService) {}

  async listForPatient(tenantId: string, patientId: string): Promise<EmrTreatmentPlanSummary[]> {
    const rows = await this.prisma.treatmentPlan.findMany({
      where: { tenantId, patientId },
      orderBy: { updatedAt: 'desc' },
      include: {
        phases: {
          orderBy: { sortOrder: 'asc' },
          include: { items: { orderBy: { sortOrder: 'asc' } } },
        },
      },
      take: 20,
    });

    return rows.map((plan) => {
      const items = plan.phases.flatMap((p) => p.items);
      const completed = items.filter((i) => i.status === 'COMPLETED').length;
      return {
        id: plan.id,
        patientId: plan.patientId,
        title: plan.title,
        status: plan.status.toLowerCase().replace(/_/g, '-'),
        totalItems: items.length,
        completedItems: completed,
        totalEstimatedCost: plan.totalEstimatedCost ? Number(plan.totalEstimatedCost) : null,
        currency: plan.currency,
        updatedAt: plan.updatedAt.toISOString(),
        phases: plan.phases.map((phase) => ({
          id: phase.id,
          name: phase.name,
          sortOrder: phase.sortOrder,
          items: phase.items.map((item) => ({
            id: item.id,
            code: item.code,
            description: item.description,
            status: item.status.toLowerCase().replace(/_/g, '-'),
            estimatedCost: Number(item.estimatedCost),
            completedAt: item.completedAt?.toISOString() ?? null,
            encounterId: item.encounterId,
          })),
        })),
      };
    });
  }
}
