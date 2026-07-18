import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { CreateNotificationHandler } from '../handlers/create-notification.handler';
import { NotificationAutomationRule, NotificationTemplate } from '@prisma/client';

export interface AutomationEventContext {
  tenantId: string;
  branchId?: string | null;
  patientId?: string;
  userId?: string;
  providerId?: string;
  variables?: Record<string, string>;
}

type RuleWithTemplate = NotificationAutomationRule & { template: NotificationTemplate | null };

@Injectable()
export class NotificationAutomationExecutorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly createNotification: CreateNotificationHandler,
  ) {}

  async executeForEventType(eventType: string, context: AutomationEventContext): Promise<number> {
    const rules = await this.prisma.notificationAutomationRule.findMany({
      where: { tenantId: context.tenantId, isActive: true, eventType },
      include: { template: true },
    });
    let sent = 0;
    for (const rule of rules) {
      sent += await this.executeRule(rule, context);
    }
    return sent;
  }

  async executeRule(rule: RuleWithTemplate, context: AutomationEventContext): Promise<number> {
    const roles = (rule.recipientRoles as string[]) ?? [];
    const recipients = await this.resolveRecipients(context.tenantId, roles, context);
    if (!recipients.length) return 0;

    let title = rule.name;
    let body = rule.name;
    if (rule.template) {
      title = this.applyVariables(rule.template.subjectEn, context.variables ?? {});
      body = this.applyVariables(rule.template.bodyEn, context.variables ?? {});
    }

    let sent = 0;
    for (const recipientId of recipients) {
      await this.createNotification.execute({
        recipientId,
        channel: rule.channel.toLowerCase().replace('_', '-') as 'in-app',
        title,
        body,
        priority: 'medium',
        branchId: context.branchId ?? null,
      });
      sent++;
    }
    return sent;
  }

  async resolveRecipients(
    tenantId: string,
    roles: string[],
    context: AutomationEventContext,
  ): Promise<string[]> {
    const normalized = roles.map((r) => r.toLowerCase());
    if (normalized.includes('patient') && context.patientId) {
      return [context.patientId];
    }
    if (normalized.includes('user') && context.userId) {
      return [context.userId];
    }
    if (normalized.includes('provider') && context.providerId) {
      return [context.providerId];
    }
    if (!roles.length) return [];
    const roleEnums = roles.map((r) => r.toUpperCase().replace('-', '_'));
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        isActive: true,
        roles: { some: { role: { in: roleEnums as never } } },
      },
      select: { id: true },
      take: 50,
    });
    return users.map((u) => u.id);
  }

  private applyVariables(text: string, variables: Record<string, string>): string {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
  }
}
