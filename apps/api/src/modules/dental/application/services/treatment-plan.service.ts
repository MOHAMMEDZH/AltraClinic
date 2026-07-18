import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TreatmentPlanItemStatus, TreatmentPlanStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';

type ItemInput = {
  id?: string;
  code: string;
  description: string;
  toothNumbers?: number[];
  estimatedMinutes?: number;
  estimatedCost?: number;
  dependsOnItemId?: string | null;
  insuranceEligible?: boolean;
  insuranceEstimate?: number | null;
  patientPortion?: number | null;
  requiresPreAuth?: boolean;
  preAuthStatus?: string | null;
  status?: TreatmentPlanItemStatus;
};

type PhaseInput = {
  id?: string;
  name: string;
  sortOrder?: number;
  visitNumber?: number | null;
  estimatedVisitDate?: string | null;
  clinicalNotes?: string | null;
  items?: ItemInput[];
};

@Injectable()
export class TreatmentPlanService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, filters: { patientId?: string; status?: string }) {
    const where: Prisma.TreatmentPlanWhereInput = { tenantId };
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.status) {
      where.status = filters.status.toUpperCase().replace(/-/g, '_') as TreatmentPlanStatus;
    }

    const rows = await this.prisma.treatmentPlan.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        phases: {
          orderBy: { sortOrder: 'asc' },
          include: { items: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });

    return { items: rows.map((r) => this.toPlanSummary(r)) };
  }

  async getById(tenantId: string, planId: string) {
    const plan = await this.loadPlan(tenantId, planId);
    return this.toPlanDetail(plan);
  }

  async create(
    tenantId: string,
    userId: string,
    input: {
      patientId: string;
      title: string;
      clinicalNotes?: string | null;
      insuranceSnapshot?: Record<string, unknown>;
      phases?: PhaseInput[];
    },
  ) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: input.patientId, tenantId, deletedAt: null },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const phases = input.phases?.length
      ? input.phases
      : [
          { name: 'Phase 1 — Initial', sortOrder: 0, visitNumber: 1, items: [] },
          { name: 'Phase 2 — Restorative', sortOrder: 1, visitNumber: 2, items: [] },
        ];

    const plan = await this.prisma.$transaction(async (tx) => {
      const created = await tx.treatmentPlan.create({
        data: {
          tenantId,
          patientId: input.patientId,
          title: input.title,
          clinicalNotes: input.clinicalNotes ?? null,
          insuranceSnapshot: (input.insuranceSnapshot ?? {}) as Prisma.InputJsonValue,
          createdBy: userId,
          status: 'DRAFT',
        },
      });

      for (let pi = 0; pi < phases.length; pi++) {
        const phase = phases[pi];
        const phaseRow = await tx.treatmentPhase.create({
          data: {
            planId: created.id,
            tenantId,
            name: phase.name,
            sortOrder: phase.sortOrder ?? pi,
            visitNumber: phase.visitNumber ?? pi + 1,
            estimatedVisitDate: phase.estimatedVisitDate ? new Date(phase.estimatedVisitDate) : null,
            clinicalNotes: phase.clinicalNotes ?? null,
          },
        });

        const items = phase.items ?? [];
        for (let ii = 0; ii < items.length; ii++) {
          await tx.treatmentPlanItem.create({
            data: this.itemCreateData(tenantId, phaseRow.id, items[ii], ii),
          });
        }
      }

      await this.recalculateTotals(tx, created.id);
      return created.id;
    });

    return this.getById(tenantId, plan);
  }

  async update(
    tenantId: string,
    planId: string,
    input: {
      title?: string;
      clinicalNotes?: string | null;
      insuranceSnapshot?: Record<string, unknown>;
      phases?: PhaseInput[];
    },
  ) {
    const existing = await this.loadPlan(tenantId, planId);
    if (['COMPLETED', 'CANCELLED'].includes(existing.status)) {
      throw new BadRequestException('Cannot edit a completed or cancelled plan');
    }

    await this.prisma.$transaction(async (tx) => {
      if (input.title !== undefined || input.clinicalNotes !== undefined || input.insuranceSnapshot !== undefined) {
        await tx.treatmentPlan.update({
          where: { id: planId },
          data: {
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.clinicalNotes !== undefined ? { clinicalNotes: input.clinicalNotes } : {}),
            ...(input.insuranceSnapshot !== undefined
              ? { insuranceSnapshot: input.insuranceSnapshot as Prisma.InputJsonValue }
              : {}),
          },
        });
      }

      if (input.phases) {
        const incomingIds = new Set(input.phases.map((p) => p.id).filter(Boolean) as string[]);
        for (const phase of existing.phases) {
          if (!incomingIds.has(phase.id)) {
            await tx.treatmentPhase.delete({ where: { id: phase.id } });
          }
        }

        for (let pi = 0; pi < input.phases.length; pi++) {
          const phaseInput = input.phases[pi];
          let phaseId = phaseInput.id;

          if (phaseId) {
            await tx.treatmentPhase.update({
              where: { id: phaseId },
              data: {
                name: phaseInput.name,
                sortOrder: phaseInput.sortOrder ?? pi,
                visitNumber: phaseInput.visitNumber ?? null,
                estimatedVisitDate: phaseInput.estimatedVisitDate ? new Date(phaseInput.estimatedVisitDate) : null,
                clinicalNotes: phaseInput.clinicalNotes ?? null,
              },
            });
          } else {
            const created = await tx.treatmentPhase.create({
              data: {
                planId,
                tenantId,
                name: phaseInput.name,
                sortOrder: phaseInput.sortOrder ?? pi,
                visitNumber: phaseInput.visitNumber ?? pi + 1,
                estimatedVisitDate: phaseInput.estimatedVisitDate ? new Date(phaseInput.estimatedVisitDate) : null,
                clinicalNotes: phaseInput.clinicalNotes ?? null,
              },
            });
            phaseId = created.id;
          }

          const items = phaseInput.items ?? [];
          const existingPhase = existing.phases.find((p) => p.id === phaseId);
          const existingItemIds = new Set((existingPhase?.items ?? []).map((i) => i.id));
          const incomingItemIds = new Set(items.map((i) => i.id).filter(Boolean) as string[]);

          for (const itemId of existingItemIds) {
            if (!incomingItemIds.has(itemId)) {
              await tx.treatmentPlanItem.delete({ where: { id: itemId } });
            }
          }

          for (let ii = 0; ii < items.length; ii++) {
            const item = items[ii];
            if (item.id && existingItemIds.has(item.id)) {
              await tx.treatmentPlanItem.update({
                where: { id: item.id },
                data: {
                  phaseId: phaseId!,
                  sortOrder: ii,
                  code: item.code,
                  description: item.description,
                  toothNumbers: (item.toothNumbers ?? []) as Prisma.InputJsonValue,
                  estimatedMinutes: item.estimatedMinutes ?? 30,
                  estimatedCost: item.estimatedCost ?? 0,
                  dependsOnItemId: item.dependsOnItemId ?? null,
                  insuranceEligible: item.insuranceEligible ?? true,
                  insuranceEstimate: item.insuranceEstimate ?? null,
                  patientPortion: item.patientPortion ?? null,
                  requiresPreAuth: item.requiresPreAuth ?? false,
                  preAuthStatus: item.preAuthStatus ?? null,
                  ...(item.status ? { status: item.status } : {}),
                },
              });
            } else {
              await tx.treatmentPlanItem.create({
                data: this.itemCreateData(tenantId, phaseId!, item, ii),
              });
            }
          }
        }

        await this.validateDependencies(tx, planId);
        await this.recalculateTotals(tx, planId);
      }
    });

    return this.getById(tenantId, planId);
  }

  async submitForApproval(tenantId: string, planId: string, userId: string) {
    const plan = await this.loadPlan(tenantId, planId);
    if (plan.status !== 'DRAFT') throw new BadRequestException('Only draft plans can be submitted');
    if (!plan.phases.some((p) => p.items.length > 0)) {
      throw new BadRequestException('Plan must contain at least one procedure');
    }
    await this.validateDependencies(this.prisma, planId);

    await this.prisma.treatmentPlan.update({
      where: { id: planId },
      data: { status: 'PENDING_APPROVAL', submittedAt: new Date(), submittedBy: userId },
    });
    return this.getById(tenantId, planId);
  }

  async approve(tenantId: string, planId: string, userId: string) {
    const plan = await this.loadPlan(tenantId, planId);
    if (plan.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Plan must be pending approval');
    }
    if (!plan.consentSignedAt) {
      throw new BadRequestException('Patient consent must be recorded before approval');
    }

    await this.prisma.treatmentPlan.update({
      where: { id: planId },
      data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: userId },
    });
    return this.getById(tenantId, planId);
  }

  async recordConsent(
    tenantId: string,
    planId: string,
    userId: string,
    input: { method?: string },
  ) {
    await this.loadPlan(tenantId, planId);
    await this.prisma.treatmentPlan.update({
      where: { id: planId },
      data: {
        consentSignedAt: new Date(),
        consentRecordedBy: userId,
        consentMethod: input.method ?? 'in_clinic',
      },
    });
    return this.getById(tenantId, planId);
  }

  async updateItemStatus(
    tenantId: string,
    planId: string,
    itemId: string,
    status: TreatmentPlanItemStatus,
    userId: string,
  ) {
    const plan = await this.loadPlan(tenantId, planId);
    const item = plan.phases.flatMap((p) => p.items).find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Procedure not found');

    if (status === 'COMPLETED' && item.dependsOnItemId) {
      const dep = plan.phases.flatMap((p) => p.items).find((i) => i.id === item.dependsOnItemId);
      if (dep && dep.status !== 'COMPLETED') {
        throw new BadRequestException('Complete prerequisite procedures first');
      }
    }

    await this.prisma.treatmentPlanItem.update({
      where: { id: itemId },
      data: {
        status,
        ...(status === 'COMPLETED'
          ? { completedAt: new Date(), completedBy: userId }
          : { completedAt: null, completedBy: null }),
      },
    });

    const updated = await this.loadPlan(tenantId, planId);
    const allItems = updated.phases.flatMap((p) => p.items);
    const completed = allItems.filter((i) => i.status === 'COMPLETED').length;
    let planStatus = updated.status;
    if (completed > 0 && updated.status === 'APPROVED') planStatus = 'IN_PROGRESS';
    if (completed === allItems.length && allItems.length > 0) planStatus = 'COMPLETED';

    if (planStatus !== updated.status) {
      await this.prisma.treatmentPlan.update({
        where: { id: planId },
        data: { status: planStatus },
      });
    }

    return this.getById(tenantId, planId);
  }

  async getAnalytics(tenantId: string) {
    const plans = await this.prisma.treatmentPlan.findMany({
      where: { tenantId, status: { not: 'CANCELLED' } },
      include: {
        phases: { include: { items: true } },
        patient: { select: { firstName: true, lastName: true } },
      },
    });

    let totalRevenue = 0;
    let completedRevenue = 0;
    let pendingRevenue = 0;
    let totalProcedures = 0;
    let completedProcedures = 0;
    const byStatus: Record<string, number> = {};
    const byMonth: Record<string, { forecast: number; completed: number }> = {};

    for (const plan of plans) {
      byStatus[plan.status] = (byStatus[plan.status] ?? 0) + 1;
      for (const phase of plan.phases) {
        for (const item of phase.items) {
          totalProcedures++;
          const cost = Number(item.estimatedCost);
          totalRevenue += cost;
          if (item.status === 'COMPLETED') {
            completedProcedures++;
            completedRevenue += cost;
          } else if (item.status !== 'CANCELLED') {
            pendingRevenue += cost;
          }
          if (phase.estimatedVisitDate) {
            const key = phase.estimatedVisitDate.toISOString().slice(0, 7);
            if (!byMonth[key]) byMonth[key] = { forecast: 0, completed: 0 };
            byMonth[key].forecast += cost;
            if (item.status === 'COMPLETED') byMonth[key].completed += cost;
          }
        }
      }
    }

    return {
      planCount: plans.length,
      totalRevenue,
      completedRevenue,
      pendingRevenue,
      totalProcedures,
      completedProcedures,
      completionRate: totalProcedures ? Math.round((completedProcedures / totalProcedures) * 100) : 0,
      plansByStatus: byStatus,
      revenueByMonth: Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, v]) => ({ month, ...v })),
      topPlans: plans
        .map((p) => ({
          id: p.id,
          title: p.title,
          patientName: `${p.patient.firstName} ${p.patient.lastName}`,
          status: p.status.toLowerCase(),
          totalEstimatedCost: Number(p.totalEstimatedCost ?? 0),
          progress: this.calcProgress(p.phases.flatMap((ph) => ph.items)),
        }))
        .sort((a, b) => b.totalEstimatedCost - a.totalEstimatedCost)
        .slice(0, 10),
    };
  }

  private async loadPlan(tenantId: string, planId: string) {
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id: planId, tenantId },
      include: {
        phases: {
          orderBy: { sortOrder: 'asc' },
          include: { items: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
    if (!plan) throw new NotFoundException('Treatment plan not found');
    return plan;
  }

  private itemCreateData(tenantId: string, phaseId: string, item: ItemInput, sortOrder: number) {
    const cost = item.estimatedCost ?? 0;
    const insuranceEst = item.insuranceEstimate ?? (item.insuranceEligible !== false ? cost * 0.5 : 0);
    const patientPortion = item.patientPortion ?? cost - Number(insuranceEst);
    return {
      phaseId,
      tenantId,
      sortOrder,
      code: item.code,
      description: item.description,
      toothNumbers: (item.toothNumbers ?? []) as Prisma.InputJsonValue,
      estimatedMinutes: item.estimatedMinutes ?? 30,
      estimatedCost: cost,
      dependsOnItemId: item.dependsOnItemId ?? null,
      insuranceEligible: item.insuranceEligible ?? true,
      insuranceEstimate: insuranceEst,
      patientPortion,
      requiresPreAuth: item.requiresPreAuth ?? false,
      preAuthStatus: item.preAuthStatus ?? null,
      status: item.status ?? 'PLANNED',
    };
  }

  private async recalculateTotals(
    tx: Prisma.TransactionClient | PrismaService,
    planId: string,
  ) {
    const phases = await tx.treatmentPhase.findMany({
      where: { planId },
      include: { items: true },
    });
    let totalCost = 0;
    let totalMinutes = 0;
    for (const phase of phases) {
      for (const item of phase.items) {
        if (item.status !== 'CANCELLED') {
          totalCost += Number(item.estimatedCost);
          totalMinutes += item.estimatedMinutes;
        }
      }
    }
    await tx.treatmentPlan.update({
      where: { id: planId },
      data: { totalEstimatedCost: totalCost, totalEstimatedMinutes: totalMinutes },
    });
  }

  private async validateDependencies(
    tx: Prisma.TransactionClient | PrismaService,
    planId: string,
  ) {
    const phases = await tx.treatmentPhase.findMany({
      where: { planId },
      include: { items: true },
    });
    const items = phases.flatMap((p) => p.items);
    const ids = new Set(items.map((i) => i.id));

    for (const item of items) {
      if (item.dependsOnItemId) {
        if (!ids.has(item.dependsOnItemId)) {
          throw new BadRequestException(`Invalid dependency for procedure ${item.code}`);
        }
        if (item.dependsOnItemId === item.id) {
          throw new BadRequestException('Procedure cannot depend on itself');
        }
      }
    }

    const visitByItem = new Map<string, number>();
    for (const phase of phases) {
      for (const item of phase.items) {
        visitByItem.set(item.id, phase.visitNumber ?? phase.sortOrder);
      }
    }

    for (const item of items) {
      if (!item.dependsOnItemId) continue;
      const depVisit = visitByItem.get(item.dependsOnItemId) ?? 0;
      const itemVisit = visitByItem.get(item.id) ?? 0;
      if (depVisit > itemVisit) {
        throw new BadRequestException(
          `Procedure ${item.code} cannot depend on a later visit`,
        );
      }
    }
  }

  private calcProgress(items: { status: TreatmentPlanItemStatus }[]) {
    if (!items.length) return 0;
    const done = items.filter((i) => i.status === 'COMPLETED').length;
    return Math.round((done / items.length) * 100);
  }

  private toPlanSummary(plan: Awaited<ReturnType<typeof this.loadPlan>>) {
    const allItems = plan.phases.flatMap((p) => p.items);
    return {
      id: plan.id,
      patientId: plan.patientId,
      title: plan.title,
      status: plan.status.toLowerCase(),
      totalEstimatedCost: Number(plan.totalEstimatedCost ?? 0),
      totalEstimatedMinutes: plan.totalEstimatedMinutes,
      currency: plan.currency,
      consentSignedAt: plan.consentSignedAt?.toISOString() ?? null,
      approvedAt: plan.approvedAt?.toISOString() ?? null,
      progress: this.calcProgress(allItems),
      procedureCount: allItems.length,
      completedCount: allItems.filter((i) => i.status === 'COMPLETED').length,
      phaseCount: plan.phases.length,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
  }

  private toPlanDetail(plan: Awaited<ReturnType<typeof this.loadPlan>>) {
    const allItems = plan.phases.flatMap((p) => p.items);
    return {
      ...this.toPlanSummary(plan),
      clinicalNotes: plan.clinicalNotes,
      insuranceSnapshot: plan.insuranceSnapshot ?? {},
      submittedAt: plan.submittedAt?.toISOString() ?? null,
      approvedBy: plan.approvedBy,
      consentMethod: plan.consentMethod,
      phases: plan.phases.map((phase) => ({
        id: phase.id,
        name: phase.name,
        sortOrder: phase.sortOrder,
        visitNumber: phase.visitNumber,
        estimatedVisitDate: phase.estimatedVisitDate?.toISOString() ?? null,
        clinicalNotes: phase.clinicalNotes,
        items: phase.items.map((item) => ({
          id: item.id,
          phaseId: item.phaseId,
          sortOrder: item.sortOrder,
          code: item.code,
          description: item.description,
          toothNumbers: item.toothNumbers as number[],
          status: item.status.toLowerCase(),
          estimatedMinutes: item.estimatedMinutes,
          estimatedCost: Number(item.estimatedCost),
          dependsOnItemId: item.dependsOnItemId,
          completedAt: item.completedAt?.toISOString() ?? null,
          insuranceEligible: item.insuranceEligible,
          insuranceEstimate: item.insuranceEstimate != null ? Number(item.insuranceEstimate) : null,
          patientPortion: item.patientPortion != null ? Number(item.patientPortion) : null,
          requiresPreAuth: item.requiresPreAuth,
          preAuthStatus: item.preAuthStatus,
        })),
      })),
      progress: this.calcProgress(allItems),
      remainingProcedures: allItems.filter((i) => !['COMPLETED', 'CANCELLED'].includes(i.status)).length,
    };
  }
}
