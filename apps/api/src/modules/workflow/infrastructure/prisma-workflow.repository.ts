import { Injectable } from '@nestjs/common';
import { WorkflowStatus as PrismaWorkflowStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { Workflow } from '../domain/entities/workflow.entity';
import { WorkflowFilter, WorkflowRepository } from '../domain/repositories/workflow.repository.interface';
import { WorkflowStatusVO } from '../domain/value-objects/workflow-status.vo';

const DOMAIN_TO_PRISMA: Record<string, PrismaWorkflowStatus> = {
  active: 'ACTIVE',
  completed: 'COMPLETED',
  canceled: 'CANCELLED',
};

const PRISMA_TO_DOMAIN: Record<PrismaWorkflowStatus, string> = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'canceled',
  FAILED: 'failed',
  PAUSED: 'paused',
};

@Injectable()
export class PrismaWorkflowRepository implements WorkflowRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(workflow: Workflow): Promise<void> {
    await this.prisma.workflow.upsert({
      where: { id: workflow.id },
      create: {
        id: workflow.id,
        tenantId: workflow.tenantId,
        branchId: workflow.branchId,
        nameEn: workflow.nameEn,
        nameAr: workflow.nameAr,
        descriptionEn: workflow.descriptionEn,
        descriptionAr: workflow.descriptionAr,
        steps: workflow.steps,
        currentStepIndex: workflow.currentStepIndex,
        status: DOMAIN_TO_PRISMA[workflow.status.value] as PrismaWorkflowStatus,
        createdBy: workflow.createdBy,
        createdAt: workflow.createdAt,
      },
      update: {
        nameEn: workflow.nameEn,
        nameAr: workflow.nameAr,
        descriptionEn: workflow.descriptionEn,
        descriptionAr: workflow.descriptionAr,
        steps: workflow.steps,
        currentStepIndex: workflow.currentStepIndex,
        status: DOMAIN_TO_PRISMA[workflow.status.value] as PrismaWorkflowStatus,
        canceledBy: workflow.canceledBy,
        canceledAt: workflow.canceledAt,
        cancelReason: workflow.cancelReason,
        updatedAt: workflow.updatedAt,
      },
    });
  }

  async findById(workflowId: string, tenantId: string): Promise<Workflow | null> {
    const row = await this.prisma.workflow.findFirst({
      where: { id: workflowId, tenantId },
    });
    return row ? this.toDomain(row) : null;
  }

  async list(filter: WorkflowFilter): Promise<Workflow[]> {
    const rows = await this.prisma.workflow.findMany({
      where: {
        tenantId: filter.tenantId,
        ...(filter.branchId ? { branchId: filter.branchId } : {}),
        ...(filter.status ? { status: DOMAIN_TO_PRISMA[filter.status] as PrismaWorkflowStatus } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: filter.offset ?? 0,
      take: filter.limit ?? 50,
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    branchId: string | null;
    nameEn: string;
    nameAr: string;
    descriptionEn: string;
    descriptionAr: string;
    steps: string[];
    currentStepIndex: number;
    status: PrismaWorkflowStatus;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    canceledBy?: string | null;
    canceledAt?: Date | null;
    cancelReason?: string | null;
  }): Workflow {
    return Workflow.restore({
      workflowId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      descriptionEn: row.descriptionEn,
      descriptionAr: row.descriptionAr,
      steps: row.steps,
      currentStepIndex: row.currentStepIndex,
      status: new WorkflowStatusVO(PRISMA_TO_DOMAIN[row.status]),
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      canceledBy: row.canceledBy ?? null,
      canceledAt: row.canceledAt ?? null,
      cancelReason: row.cancelReason ?? null,
    });
  }
}
