import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { CreateNotificationHandler } from '../../../notifications/application/handlers/create-notification.handler';

export interface WorkflowAutomationContext {
  tenantId: string;
  branchId?: string | null;
  userId?: string;
  patientId?: string;
  variables?: Record<string, string>;
}

@Injectable()
export class WorkflowAutomationExecutorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly createNotification: CreateNotificationHandler,
  ) {}

  async executeForEventType(eventType: string, context: WorkflowAutomationContext): Promise<number> {
    const rules = await this.prisma.workflowAutomationRule.findMany({
      where: { tenantId: context.tenantId, isActive: true, eventType },
    });
    let executed = 0;
    for (const rule of rules) {
      executed += await this.executeRule(rule, context);
    }
    return executed;
  }

  async executeRule(
    rule: {
      id: string;
      name: string;
      actionType: string;
      actionConfig: unknown;
      templateId: string | null;
    },
    context: WorkflowAutomationContext,
  ): Promise<number> {
    const config = (rule.actionConfig as Record<string, unknown>) ?? {};
    switch (rule.actionType) {
      case 'create_task': {
        await this.prisma.workflowTask.create({
          data: {
            tenantId: context.tenantId,
            branchId: context.branchId ?? null,
            title: rule.name,
            status: 'PENDING',
            priority: 'MEDIUM',
            metadata: { source: 'automation', ruleId: rule.id, variables: context.variables ?? {} },
          },
        });
        return 1;
      }
      case 'request_approval': {
        await this.prisma.workflowApproval.create({
          data: {
            tenantId: context.tenantId,
            branchId: context.branchId ?? null,
            title: rule.name,
            status: 'PENDING',
            mode: 'SINGLE',
            requestedBy: context.userId ?? context.tenantId,
            category: String(config.category ?? 'automation'),
          },
        });
        return 1;
      }
      case 'send_notification': {
        const recipientId = context.userId ?? (config.recipientId as string | undefined);
        if (!recipientId) return 0;
        await this.createNotification.execute({
          recipientId,
          channel: 'in-app',
          title: rule.name,
          body: rule.name,
          priority: 'medium',
          branchId: context.branchId ?? null,
        });
        return 1;
      }
      case 'escalate': {
        const overdue = await this.prisma.workflowTask.findMany({
          where: {
            tenantId: context.tenantId,
            status: { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] },
            dueAt: { lt: new Date() },
          },
          take: 50,
        });
        for (const task of overdue) {
          await this.prisma.workflowTask.update({
            where: { id: task.id },
            data: { status: 'ESCALATED' },
          });
        }
        return overdue.length;
      }
      case 'webhook': {
        const url = String(config.url ?? '').trim();
        if (!url) return 0;
        const method = String(config.method ?? 'POST').toUpperCase();
        const timeoutMs = Number(config.timeoutMs ?? 10_000);
        const payload = (config.body as Record<string, unknown>) ?? context.variables ?? {};
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(typeof config.headers === 'object' && config.headers
            ? (config.headers as Record<string, string>)
            : {}),
        };
        let statusCode = 0;
        let ok = false;
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          const response = await fetch(url, {
            method,
            headers,
            body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(payload),
            signal: controller.signal,
          });
          clearTimeout(timer);
          statusCode = response.status;
          ok = response.ok;
        } catch {
          ok = false;
        }
        const workflowId = context.variables?.workflowId;
        if (workflowId) {
          await this.prisma.workflowExecutionLog.create({
            data: {
              tenantId: context.tenantId,
              workflowId,
              eventType: ok ? 'webhook.executed' : 'webhook.failed',
              details: {
                ruleId: rule.id,
                url,
                method,
                statusCode,
                ok,
              } as Prisma.InputJsonValue,
            },
          });
        }
        return ok ? 1 : 0;
      }
      default:
        return 0;
    }
  }
}
