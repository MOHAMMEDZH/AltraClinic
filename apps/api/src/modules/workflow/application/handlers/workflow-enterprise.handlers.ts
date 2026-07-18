import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  WorkflowApprovalStatus as PrismaApprovalStatus,
  WorkflowStatus as PrismaWorkflowStatus,
  WorkflowTaskPriority as PrismaTaskPriority,
  WorkflowTaskStatus as PrismaTaskStatus,
  WorkflowTemplateStatus as PrismaTemplateStatus,
} from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { WORKFLOW_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { WorkflowRepository } from '../../domain/repositories/workflow.repository.interface';
import { CreateWorkflowHandler } from './create-workflow.handler';
import { AdvanceWorkflowHandler } from './advance-workflow.handler';
import { CreateWorkflowCommand } from '../commands/create-workflow.command';
import {
  NOTIFICATION_AUDIT_LOG,
  NotificationAuditLog,
} from '../../../notifications/application/ports/notification-audit-log.port';
import { WorkflowRealtimeService } from '../services/workflow-realtime.service';

const STATUS_MAP: Record<string, PrismaWorkflowStatus> = {
  active: 'ACTIVE',
  completed: 'COMPLETED',
  canceled: 'CANCELLED',
  cancelled: 'CANCELLED',
  failed: 'FAILED',
  paused: 'PAUSED',
};

const TASK_STATUS_MAP: Record<string, PrismaTaskStatus> = {
  draft: 'DRAFT',
  pending: 'PENDING',
  assigned: 'ASSIGNED',
  in_progress: 'IN_PROGRESS',
  waiting_approval: 'WAITING_APPROVAL',
  approved: 'APPROVED',
  rejected: 'REJECTED',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
  overdue: 'OVERDUE',
  escalated: 'ESCALATED',
};

function workflowDto(row: {
  id: string;
  tenantId: string;
  branchId: string | null;
  templateId: string | null;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  steps: string[];
  currentStepIndex: number;
  status: PrismaWorkflowStatus;
  triggerType: string | null;
  priority: PrismaTaskPriority | null;
  assigneeId: string | null;
  dueAt: Date | null;
  createdBy: string;
  canceledBy: string | null;
  canceledAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    workflowId: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    templateId: row.templateId,
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    descriptionEn: row.descriptionEn,
    descriptionAr: row.descriptionAr,
    steps: row.steps,
    currentStepIndex: row.currentStepIndex,
    currentStep: row.steps[row.currentStepIndex] ?? null,
    stepsTotal: row.steps.length,
    status: row.status.toLowerCase(),
    triggerType: row.triggerType,
    priority: row.priority?.toLowerCase() ?? 'medium',
    assigneeId: row.assigneeId,
    dueAt: row.dueAt?.toISOString() ?? null,
    createdBy: row.createdBy,
    canceledBy: row.canceledBy,
    canceledAt: row.canceledAt?.toISOString() ?? null,
    cancelReason: row.cancelReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class GetWorkflowOverviewHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(assigneeId?: string) {
    const tenant = await this.tenantContext.resolve();
    const base: Prisma.WorkflowWhereInput = { tenantId: tenant.tenantId };
    const taskBase: Prisma.WorkflowTaskWhereInput = { tenantId: tenant.tenantId };
    const approvalBase: Prisma.WorkflowApprovalWhereInput = { tenantId: tenant.tenantId };

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const [
      activeWorkflows,
      pendingApprovals,
      myTasks,
      overdueTasks,
      completedToday,
      failedWorkflows,
      pendingTasks,
      failedAutomations,
    ] = await Promise.all([
      this.prisma.workflow.count({ where: { ...base, status: 'ACTIVE' } }),
      this.prisma.workflowApproval.count({ where: { ...approvalBase, status: 'PENDING' } }),
      assigneeId
        ? this.prisma.workflowTask.count({
            where: { ...taskBase, assigneeId, status: { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_APPROVAL'] } },
          })
        : this.prisma.workflowTask.count({
            where: { ...taskBase, status: { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_APPROVAL'] } },
          }),
      this.prisma.workflowTask.count({
        where: {
          ...taskBase,
          ...(assigneeId ? { assigneeId } : {}),
          status: { in: ['OVERDUE', 'ESCALATED'] },
        },
      }),
      this.prisma.workflow.count({
        where: { ...base, status: 'COMPLETED', updatedAt: { gte: startOfDay } },
      }),
      this.prisma.workflow.count({ where: { ...base, status: 'FAILED' } }),
      this.prisma.workflowTask.count({ where: { ...taskBase, status: 'PENDING' } }),
      this.prisma.workflowAutomationRule.count({
        where: { tenantId: tenant.tenantId, isActive: false },
      }),
    ]);

    const decidedApprovals = await this.prisma.workflowApproval.findMany({
      where: {
        ...approvalBase,
        status: { in: ['APPROVED', 'REJECTED'] },
        decidedAt: { not: null },
      },
      select: { createdAt: true, decidedAt: true },
      take: 200,
      orderBy: { decidedAt: 'desc' },
    });
    const avgApprovalTimeMs =
      decidedApprovals.length > 0
        ? Math.round(
            decidedApprovals.reduce((sum, a) => {
              const ms = (a.decidedAt!.getTime() - a.createdAt.getTime());
              return sum + ms;
            }, 0) / decidedApprovals.length,
          )
        : 0;

    const taskLoadByRole = await this.prisma.$queryRaw<Array<{ role: string; count: bigint }>>`
      SELECT ura.role::text AS role, COUNT(t.id)::bigint AS count
      FROM workflow_tasks t
      JOIN user_role_assignments ura ON ura."userId" = t."assigneeId"
      WHERE t."tenantId" = ${tenant.tenantId}::uuid
        AND t.status NOT IN ('COMPLETED', 'CANCELLED')
      GROUP BY ura.role
      ORDER BY count DESC
      LIMIT 10
    `.catch(() => [] as Array<{ role: string; count: bigint }>);

    const taskLoadByBranch = await this.prisma.workflowTask.groupBy({
      by: ['branchId'],
      where: { ...taskBase, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const recentActivity = await this.prisma.workflowExecutionLog.findMany({
      where: { tenantId: tenant.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { workflow: { select: { nameEn: true } } },
    });

    const total = await this.prisma.workflow.count({ where: base });
    const completed = await this.prisma.workflow.count({ where: { ...base, status: 'COMPLETED' } });

    return {
      activeWorkflows,
      pendingApprovals,
      myTasks,
      overdueTasks,
      completedToday,
      failedWorkflows,
      pendingTasks,
      failedAutomations,
      avgApprovalTimeMs,
      avgApprovalTimeHours: Math.round((avgApprovalTimeMs / 3_600_000) * 10) / 10,
      taskLoadByRole: taskLoadByRole.map((r) => ({ role: r.role, count: Number(r.count) })),
      taskLoadByBranch: taskLoadByBranch.map((b) => ({
        branchId: b.branchId,
        count: b._count.id,
      })),
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 100,
      recentActivity: recentActivity.map((log) => ({
        id: log.id,
        workflowId: log.workflowId,
        workflowName: log.workflow.nameEn,
        eventType: log.eventType,
        stepIndex: log.stepIndex,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  }
}

@Injectable()
export class ListWorkflowsPaginatedHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: {
    status?: string;
    branchId?: string;
    search?: string;
    assigneeId?: string;
    limit?: number;
    cursor?: string;
  }) {
    const tenant = await this.tenantContext.resolve();
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const where: Prisma.WorkflowWhereInput = {
      tenantId: tenant.tenantId,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
      ...(query.status ? { status: STATUS_MAP[query.status.toLowerCase()] ?? 'ACTIVE' } : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              { nameEn: { contains: query.search.trim(), mode: 'insensitive' } },
              { nameAr: { contains: query.search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.cursor ? { createdAt: { lt: new Date(query.cursor) } } : {}),
    };
    const rows = await this.prisma.workflow.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(workflowDto);
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.createdAt ?? null : null,
    };
  }
}

@Injectable()
export class ListWorkflowTasksHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: {
    assigneeId?: string;
    status?: string;
    overdueOnly?: boolean;
    branchId?: string;
    limit?: number;
    cursor?: string;
  }) {
    const tenant = await this.tenantContext.resolve();
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const where: Prisma.WorkflowTaskWhereInput = {
      tenantId: tenant.tenantId,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
      ...(query.status ? { status: TASK_STATUS_MAP[query.status.toLowerCase()] ?? 'PENDING' } : {}),
      ...(query.overdueOnly
        ? { dueAt: { lt: new Date() }, status: { notIn: ['COMPLETED', 'CANCELLED'] } }
        : {}),
      ...(query.cursor ? { createdAt: { lt: new Date(query.cursor) } } : {}),
    };
    const rows = await this.prisma.workflowTask.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
      taskId: r.id,
      workflowId: r.workflowId,
      title: r.title,
      titleAr: r.titleAr,
      status: r.status.toLowerCase(),
      priority: r.priority.toLowerCase(),
      assigneeId: r.assigneeId,
      dueAt: r.dueAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
    return { items, nextCursor: hasMore ? items[items.length - 1]?.createdAt ?? null : null };
  }
}

@Injectable()
export class UpdateWorkflowTaskHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
    private readonly workflowRealtime: WorkflowRealtimeService,
  ) {}

  async execute(
    taskId: string,
    input: { status?: string; assigneeId?: string; priority?: string; comment?: string },
    actorId: string,
    actorRoles: string[] = [],
  ) {
    const tenant = await this.tenantContext.resolve();
    const existing = await this.prisma.workflowTask.findFirst({
      where: { id: taskId, tenantId: tenant.tenantId },
    });
    if (!existing) throw new NotFoundException('Task not found');
    const prevMeta = (existing.metadata as Record<string, unknown> | null) ?? {};
    const comments = Array.isArray(prevMeta.comments) ? [...prevMeta.comments] : [];
    if (input.comment?.trim()) {
      comments.push({ text: input.comment.trim(), actorId, at: new Date().toISOString() });
    }
    const row = await this.prisma.workflowTask.update({
      where: { id: taskId },
      data: {
        ...(input.status ? { status: TASK_STATUS_MAP[input.status.toLowerCase()] ?? existing.status } : {}),
        ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId, assignedBy: actorId } : {}),
        ...(input.priority
          ? { priority: input.priority.toUpperCase() as PrismaTaskPriority }
          : {}),
        ...(input.status === 'completed' ? { completedAt: new Date() } : {}),
        ...(input.comment?.trim()
          ? { metadata: { ...prevMeta, comments } as Prisma.InputJsonValue }
          : {}),
        updatedAt: new Date(),
      },
    });
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'workflow.task.updated',
      resourceId: taskId,
      actorId,
      actorRoles,
      descriptionEn: `Updated task ${row.title}`,
    });
    await this.workflowRealtime.publish(tenant.tenantId, tenant.branchId ?? null, 'workflow.task.updated', {
      taskId,
      status: row.status.toLowerCase(),
      assigneeId: row.assigneeId,
    });
    return row;
  }
}

@Injectable()
export class ListWorkflowApprovalsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: { status?: string; requestedBy?: string; limit?: number }) {
    const tenant = await this.tenantContext.resolve();
    const limit = Math.min(query.limit ?? 50, 100);
    const rows = await this.prisma.workflowApproval.findMany({
      where: {
        tenantId: tenant.tenantId,
        ...(query.status
          ? { status: query.status.toUpperCase() as PrismaApprovalStatus }
          : {}),
        ...(query.requestedBy ? { requestedBy: query.requestedBy } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      approvalId: r.id,
      workflowId: r.workflowId,
      title: r.title,
      status: r.status.toLowerCase(),
      mode: r.mode.toLowerCase(),
      category: r.category,
      requestedBy: r.requestedBy,
      dueAt: r.dueAt?.toISOString() ?? null,
      decidedAt: r.decidedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

@Injectable()
export class ApproveWorkflowRequestHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
    private readonly workflowRealtime: WorkflowRealtimeService,
  ) {}

  async execute(approvalId: string, actorId: string, comment?: string, actorRoles: string[] = []) {
    const tenant = await this.tenantContext.resolve();
    const existing = await this.prisma.workflowApproval.findFirst({
      where: { id: approvalId, tenantId: tenant.tenantId, status: 'PENDING' },
    });
    if (!existing) throw new NotFoundException('Pending approval not found');
    const row = await this.prisma.workflowApproval.update({
      where: { id: approvalId },
      data: {
        status: 'APPROVED',
        approvedBy: actorId,
        comment: comment?.trim() ?? null,
        decidedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'workflow.approval.approved',
      resourceId: approvalId,
      actorId,
      actorRoles,
      descriptionEn: `Approved ${row.title}`,
    });
    await this.workflowRealtime.publish(tenant.tenantId, tenant.branchId ?? null, 'workflow.approval.updated', {
      approvalId,
      status: 'approved',
      workflowId: row.workflowId,
    });
    return { approvalId, status: 'approved' };
  }
}

@Injectable()
export class RejectWorkflowRequestHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
    private readonly workflowRealtime: WorkflowRealtimeService,
  ) {}

  async execute(
    approvalId: string,
    actorId: string,
    reason: string,
    actorRoles: string[] = [],
  ) {
    const tenant = await this.tenantContext.resolve();
    const existing = await this.prisma.workflowApproval.findFirst({
      where: { id: approvalId, tenantId: tenant.tenantId, status: 'PENDING' },
    });
    if (!existing) throw new NotFoundException('Pending approval not found');
    if (!reason?.trim()) throw new BadRequestException('Rejection reason is required');
    await this.prisma.workflowApproval.update({
      where: { id: approvalId },
      data: {
        status: 'REJECTED',
        rejectedBy: actorId,
        rejectionReason: reason.trim(),
        decidedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'workflow.approval.rejected',
      resourceId: approvalId,
      actorId,
      actorRoles,
      descriptionEn: `Rejected approval`,
      reason: reason.trim(),
    });
    await this.workflowRealtime.publish(tenant.tenantId, tenant.branchId ?? null, 'workflow.approval.updated', {
      approvalId,
      status: 'rejected',
      workflowId: existing.workflowId,
    });
    return { approvalId, status: 'rejected' };
  }
}

@Injectable()
export class ListWorkflowTemplatesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(search?: string, category?: string) {
    const tenant = await this.tenantContext.resolve();
    return this.prisma.workflowTemplate.findMany({
      where: {
        tenantId: tenant.tenantId,
        ...(category ? { category } : {}),
        ...(search?.trim()
          ? {
              OR: [
                { nameEn: { contains: search.trim(), mode: 'insensitive' } },
                { key: { contains: search.trim(), mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { nameEn: 'asc' },
    });
  }
}

@Injectable()
export class CreateWorkflowTemplateHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
  ) {}

  async execute(
    input: {
      key: string;
      nameEn: string;
      nameAr?: string;
      descriptionEn?: string;
      descriptionAr?: string;
      category?: string;
      triggerType: string;
      steps: unknown[];
      slaHours?: number;
    },
    actorId: string,
    actorRoles: string[] = [],
  ) {
    const tenant = await this.tenantContext.resolve();
    const row = await this.prisma.workflowTemplate.create({
      data: {
        tenantId: tenant.tenantId,
        key: input.key.trim(),
        nameEn: input.nameEn.trim(),
        nameAr: input.nameAr?.trim() ?? null,
        descriptionEn: input.descriptionEn?.trim() ?? null,
        descriptionAr: input.descriptionAr?.trim() ?? null,
        category: input.category ?? 'operational',
        triggerType: input.triggerType.trim(),
        steps: input.steps as Prisma.InputJsonValue,
        slaHours: input.slaHours ?? null,
        createdBy: actorId,
        updatedBy: actorId,
      },
    });
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'workflow.template.created',
      resourceId: row.id,
      actorId,
      actorRoles,
      descriptionEn: `Created template ${row.nameEn}`,
    });
    return row;
  }
}

@Injectable()
export class UpdateWorkflowTemplateHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
  ) {}

  async execute(
    templateId: string,
    input: {
      nameEn?: string;
      nameAr?: string;
      descriptionEn?: string;
      descriptionAr?: string;
      steps?: unknown[];
      slaHours?: number;
      status?: string;
    },
    actorId: string,
    actorRoles: string[] = [],
  ) {
    const tenant = await this.tenantContext.resolve();
    const existing = await this.prisma.workflowTemplate.findFirst({
      where: { id: templateId, tenantId: tenant.tenantId },
    });
    if (!existing) throw new NotFoundException('Template not found');
    const row = await this.prisma.workflowTemplate.update({
      where: { id: templateId },
      data: {
        ...(input.nameEn !== undefined ? { nameEn: input.nameEn.trim() } : {}),
        ...(input.nameAr !== undefined ? { nameAr: input.nameAr.trim() } : {}),
        ...(input.descriptionEn !== undefined ? { descriptionEn: input.descriptionEn.trim() } : {}),
        ...(input.descriptionAr !== undefined ? { descriptionAr: input.descriptionAr.trim() } : {}),
        ...(input.steps !== undefined ? { steps: input.steps as Prisma.InputJsonValue, version: existing.version + 1 } : {}),
        ...(input.slaHours !== undefined ? { slaHours: input.slaHours } : {}),
        ...(input.status
          ? { status: input.status.toUpperCase() as PrismaTemplateStatus }
          : {}),
        updatedBy: actorId,
      },
    });
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'workflow.template.updated',
      resourceId: templateId,
      actorId,
      actorRoles,
      descriptionEn: `Updated template ${row.nameEn}`,
    });
    return row;
  }
}

@Injectable()
export class PublishWorkflowTemplateHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
  ) {}

  async execute(templateId: string, actorId: string, actorRoles: string[] = []) {
    const tenant = await this.tenantContext.resolve();
    const existing = await this.prisma.workflowTemplate.findFirst({
      where: { id: templateId, tenantId: tenant.tenantId },
    });
    if (!existing) throw new NotFoundException('Template not found');
    const steps = existing.steps as unknown[];
    if (!Array.isArray(steps) || steps.length === 0) {
      throw new BadRequestException('Template must have at least one step before publishing');
    }
    const row = await this.prisma.workflowTemplate.update({
      where: { id: templateId },
      data: { status: 'ACTIVE', publishedAt: new Date(), updatedBy: actorId },
    });
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'workflow.template.published',
      resourceId: templateId,
      actorId,
      actorRoles,
      descriptionEn: `Published template ${row.nameEn}`,
    });
    return row;
  }
}

@Injectable()
export class DuplicateWorkflowTemplateHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(templateId: string, actorId: string) {
    const tenant = await this.tenantContext.resolve();
    const existing = await this.prisma.workflowTemplate.findFirst({
      where: { id: templateId, tenantId: tenant.tenantId },
    });
    if (!existing) throw new NotFoundException('Template not found');
    return this.prisma.workflowTemplate.create({
      data: {
        tenantId: tenant.tenantId,
        key: `${existing.key}-copy-${Date.now()}`,
        nameEn: `${existing.nameEn} (copy)`,
        nameAr: existing.nameAr,
        descriptionEn: existing.descriptionEn,
        descriptionAr: existing.descriptionAr,
        category: existing.category,
        triggerType: existing.triggerType,
        steps: existing.steps as Prisma.InputJsonValue,
        slaHours: existing.slaHours,
        status: 'DRAFT',
        createdBy: actorId,
        updatedBy: actorId,
      },
    });
  }
}

@Injectable()
export class StartWorkflowFromTemplateHandler {
  constructor(
    private readonly createWorkflow: CreateWorkflowHandler,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(WORKFLOW_REPOSITORY) private readonly repo: WorkflowRepository,
  ) {}

  async execute(templateId: string, actorId: string, branchId?: string | null) {
    const tenant = await this.tenantContext.resolve();
    const template = await this.prisma.workflowTemplate.findFirst({
      where: { id: templateId, tenantId: tenant.tenantId, status: 'ACTIVE' },
    });
    if (!template) throw new NotFoundException('Active template not found');
    const stepDefs = template.steps as Array<{ labelEn?: string; labelAr?: string; type?: string }>;
    const steps = stepDefs.map((s) => s.labelEn ?? s.labelAr ?? 'Step');
    const result = await this.createWorkflow.execute(
      new CreateWorkflowCommand(
        template.nameEn,
        template.nameAr ?? template.nameEn,
        template.descriptionEn ?? template.nameEn,
        template.descriptionAr ?? template.nameAr ?? template.nameEn,
        steps,
        branchId ?? tenant.branchId ?? null,
        actorId,
      ),
    );
    await this.prisma.workflow.update({
      where: { id: result.workflowId },
      data: { templateId, triggerType: template.triggerType },
    });
    await this.prisma.workflowExecutionLog.create({
      data: {
        tenantId: tenant.tenantId,
        workflowId: result.workflowId,
        stepIndex: 0,
        eventType: 'workflow.started',
        actorId,
        details: { templateId },
      },
    });
    return result;
  }
}

@Injectable()
export class ListWorkflowAutomationRulesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute() {
    const tenant = await this.tenantContext.resolve();
    return this.prisma.workflowAutomationRule.findMany({
      where: { tenantId: tenant.tenantId },
      orderBy: { name: 'asc' },
    });
  }
}

@Injectable()
export class CreateWorkflowAutomationRuleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
  ) {}

  async execute(
    input: {
      name: string;
      nameAr?: string;
      eventType: string;
      actionType: string;
      actionConfig?: Record<string, unknown>;
      templateId?: string;
      isActive?: boolean;
    },
    actorId: string,
    actorRoles: string[] = [],
  ) {
    const tenant = await this.tenantContext.resolve();
    const row = await this.prisma.workflowAutomationRule.create({
      data: {
        tenantId: tenant.tenantId,
        name: input.name.trim(),
        nameAr: input.nameAr?.trim() ?? null,
        eventType: input.eventType.trim(),
        actionType: input.actionType.trim(),
        actionConfig: (input.actionConfig ?? {}) as Prisma.InputJsonValue,
        templateId: input.templateId ?? null,
        isActive: input.isActive ?? true,
        createdBy: actorId,
      },
    });
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'workflow.automation.created',
      resourceId: row.id,
      actorId,
      actorRoles,
      descriptionEn: `Created automation rule ${row.name}`,
    });
    return row;
  }
}

@Injectable()
export class ListWorkflowExecutionLogsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: { workflowId?: string; limit?: number }) {
    const tenant = await this.tenantContext.resolve();
    const rows = await this.prisma.workflowExecutionLog.findMany({
      where: {
        tenantId: tenant.tenantId,
        ...(query.workflowId ? { workflowId: query.workflowId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(query.limit ?? 100, 500),
      include: { workflow: { select: { nameEn: true } } },
    });
    return rows.map((r) => ({
      logId: r.id,
      workflowId: r.workflowId,
      workflowName: r.workflow.nameEn,
      stepIndex: r.stepIndex,
      eventType: r.eventType,
      actorId: r.actorId,
      details: r.details,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

@Injectable()
export class LogWorkflowAdvanceHandler {
  constructor(
    private readonly advanceWorkflow: AdvanceWorkflowHandler,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(workflowId: string, actionedBy: string, comment?: string | null) {
    await this.advanceWorkflow.execute({ workflowId, actionedBy, comment: comment ?? null });
    const tenant = await this.tenantContext.resolve();
    const wf = await this.prisma.workflow.findFirst({ where: { id: workflowId, tenantId: tenant.tenantId } });
    if (wf) {
      await this.prisma.workflowExecutionLog.create({
        data: {
          tenantId: tenant.tenantId,
          workflowId,
          stepIndex: wf.currentStepIndex,
          eventType: wf.status === 'COMPLETED' ? 'workflow.completed' : 'workflow.advanced',
          actorId: actionedBy,
          details: comment ? { comment } : undefined,
        },
      });
    }
    return { workflowId, status: wf?.status.toLowerCase() ?? 'active' };
  }
}

@Injectable()
export class GetWorkflowTaskHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(taskId: string) {
    const tenant = await this.tenantContext.resolve();
    const row = await this.prisma.workflowTask.findFirst({
      where: { id: taskId, tenantId: tenant.tenantId },
      include: { workflow: { select: { nameEn: true, nameAr: true, status: true } } },
    });
    if (!row) throw new NotFoundException('Task not found');
    const meta = (row.metadata as Record<string, unknown> | null) ?? {};
    return {
      taskId: row.id,
      workflowId: row.workflowId,
      workflowName: row.workflow?.nameEn ?? null,
      title: row.title,
      titleAr: row.titleAr,
      description: row.description,
      status: row.status.toLowerCase(),
      priority: row.priority.toLowerCase(),
      assigneeId: row.assigneeId,
      dueAt: row.dueAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      comments: meta.comments ?? [],
      attachments: meta.attachments ?? [],
      timeline: meta.timeline ?? [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

@Injectable()
export class ListWorkflowSavedFiltersHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, scope?: string) {
    const tenant = await this.tenantContext.resolve();
    return this.prisma.workflowSavedFilter.findMany({
      where: {
        tenantId: tenant.tenantId,
        userId,
        ...(scope ? { name: { startsWith: `${scope}:` } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

@Injectable()
export class SaveWorkflowFilterHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, name: string, filters: Record<string, unknown>, scope?: string) {
    const tenant = await this.tenantContext.resolve();
    const fullName = scope ? `${scope}:${name.trim()}` : name.trim();
    return this.prisma.workflowSavedFilter.create({
      data: { tenantId: tenant.tenantId, userId, name: fullName, filters: filters as object },
    });
  }
}

@Injectable()
export class DeleteWorkflowSavedFilterHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, filterId: string) {
    const tenant = await this.tenantContext.resolve();
    const row = await this.prisma.workflowSavedFilter.findFirst({
      where: { id: filterId, tenantId: tenant.tenantId, userId },
    });
    if (!row) throw new NotFoundException('Filter not found');
    await this.prisma.workflowSavedFilter.delete({ where: { id: filterId } });
    return { id: filterId };
  }
}

@Injectable()
export class ExportWorkflowLogsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
  ) {}

  async execute(actorId: string, actorRoles: string[] = [], workflowId?: string) {
    const tenant = await this.tenantContext.resolve();
    const rows = await this.prisma.workflowExecutionLog.findMany({
      where: {
        tenantId: tenant.tenantId,
        ...(workflowId ? { workflowId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
      include: { workflow: { select: { nameEn: true } } },
    });
    const header = 'logId,workflowId,workflowName,eventType,stepIndex,actorId,createdAt\n';
    const body = rows
      .map((r) =>
        [
          r.id,
          r.workflowId,
          `"${r.workflow.nameEn.replace(/"/g, '""')}"`,
          r.eventType,
          r.stepIndex ?? '',
          r.actorId ?? '',
          r.createdAt.toISOString(),
        ].join(','),
      )
      .join('\n');
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'workflow.logs.exported',
      resourceId: workflowId ?? 'all',
      actorId,
      actorRoles,
      descriptionEn: 'Exported workflow execution logs',
    });
    return { csv: header + body, count: rows.length };
  }
}

@Injectable()
export class ListWorkflowAuditHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: { limit?: number; resourceId?: string }) {
    const tenant = await this.tenantContext.resolve();
    const rows = await this.prisma.auditEntry.findMany({
      where: {
        tenantId: tenant.tenantId,
        action: { startsWith: 'workflow.' },
        ...(query.resourceId ? { resourceId: query.resourceId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(query.limit ?? 100, 500),
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      resourceId: r.resourceId,
      actorId: r.actorId,
      actorRoles: r.actorRoles,
      descriptionEn: r.descriptionEn,
      descriptionAr: r.descriptionAr,
      changes: r.changes,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

@Injectable()
export class RetryFailedWorkflowHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(NOTIFICATION_AUDIT_LOG) private readonly audit: NotificationAuditLog,
  ) {}

  async execute(workflowId: string, actorId: string, actorRoles: string[] = []) {
    const tenant = await this.tenantContext.resolve();
    const wf = await this.prisma.workflow.findFirst({
      where: { id: workflowId, tenantId: tenant.tenantId, status: 'FAILED' },
    });
    if (!wf) throw new NotFoundException('Failed workflow not found');
    await this.prisma.workflow.update({
      where: { id: workflowId },
      data: { status: 'ACTIVE', updatedAt: new Date() },
    });
    await this.prisma.workflowExecutionLog.create({
      data: {
        tenantId: tenant.tenantId,
        workflowId,
        stepIndex: wf.currentStepIndex,
        eventType: 'workflow.retried',
        actorId,
        details: { previousStatus: 'failed' },
      },
    });
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'workflow.retried',
      resourceId: workflowId,
      actorId,
      actorRoles,
      descriptionEn: `Retried failed workflow ${wf.nameEn}`,
    });
    return { workflowId, status: 'active' };
  }
}
