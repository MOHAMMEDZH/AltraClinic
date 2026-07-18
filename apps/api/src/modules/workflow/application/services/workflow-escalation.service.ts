import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { CreateNotificationHandler } from '../../../notifications/application/handlers/create-notification.handler';
import { LicensingExecutionGuard } from '../../../subscription/application/services/licensing-execution.guard';

@Injectable()
export class WorkflowEscalationService {
  private readonly logger = new Logger(WorkflowEscalationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly createNotification: CreateNotificationHandler,
    private readonly licensing: LicensingExecutionGuard,
  ) {}

  async processOverdueTasksAndApprovals(): Promise<{ escalatedTasks: number; escalatedApprovals: number }> {
    const now = new Date();
    let escalatedTasks = 0;
    let escalatedApprovals = 0;

    const overdueTasks = await this.prisma.workflowTask.findMany({
      where: {
        status: { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] },
        dueAt: { lt: now },
      },
      take: 200,
    });

    for (const task of overdueTasks) {
      const allowed = await this.licensing.allowWorkerExecution({
        tenantId: task.tenantId,
        workerName: 'workflow-escalation',
        moduleId: 'workflow',
        source: 'worker.workflow_escalation',
      });
      if (!allowed) continue;

      await this.prisma.workflowTask.update({
        where: { id: task.id },
        data: { status: 'ESCALATED' },
      });
      if (task.workflowId) {
        await this.prisma.workflowExecutionLog.create({
          data: {
            tenantId: task.tenantId,
            workflowId: task.workflowId,
            eventType: 'task.escalated',
            details: { taskId: task.id, reason: 'overdue' },
          },
        }).catch(() => undefined);
      }
      if (task.assigneeId) {
        await this.createNotification.execute({
          recipientId: task.assigneeId,
          channel: 'in-app',
          title: 'Task escalated',
          body: `Task "${task.title}" is overdue and has been escalated.`,
          priority: 'high',
          branchId: task.branchId,
        }).catch(() => undefined);
      }
      escalatedTasks++;
    }

    const overdueApprovals = await this.prisma.workflowApproval.findMany({
      where: {
        status: 'PENDING',
        dueAt: { lt: now },
      },
      take: 100,
    });

    for (const approval of overdueApprovals) {
      const allowed = await this.licensing.allowWorkerExecution({
        tenantId: approval.tenantId,
        workerName: 'workflow-escalation',
        moduleId: 'workflow',
        source: 'worker.workflow_escalation',
      });
      if (!allowed) continue;

      if (approval.workflowId) {
        await this.prisma.workflowExecutionLog.create({
          data: {
            tenantId: approval.tenantId,
            workflowId: approval.workflowId,
            eventType: 'approval.sla_breach',
            details: { approvalId: approval.id },
          },
        }).catch(() => undefined);
      }
      escalatedApprovals++;
    }

    this.logger.log(`Escalation scan: ${escalatedTasks} tasks, ${escalatedApprovals} approval SLA breaches`);
    return { escalatedTasks, escalatedApprovals };
  }
}
