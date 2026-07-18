import { Injectable, Logger } from '@nestjs/common';
import { NotificationIntentProducerService } from './notification-intent-producer.service';

export interface WorkflowCommunicationRequest {
  tenantId: string;
  branchId?: string | null;
  recipientId: string;
  title: string;
  body: string;
  workflowInstanceId: string;
  correlationId?: string;
  causationId?: string;
  idempotencyKey: string;
  channels?: Array<'in-app' | 'email' | 'sms' | 'push'>;
  metadata?: Record<string, unknown>;
}

/**
 * Phase 41e — Workflow may only create notification intents.
 * Existing workflow-automation.executor already uses CreateNotificationHandler;
 * this service is the explicit intent-only API for workflow producers.
 */
@Injectable()
export class WorkflowNotificationIntentService {
  private readonly logger = new Logger(WorkflowNotificationIntentService.name);

  constructor(private readonly producer: NotificationIntentProducerService) {}

  async createFromWorkflow(request: WorkflowCommunicationRequest) {
    this.logger.log(
      `Workflow communication intent tenant=${request.tenantId} workflow=${request.workflowInstanceId}`,
    );
    return this.producer.produceChannels({
      tenantId: request.tenantId,
      branchId: request.branchId,
      recipientId: request.recipientId,
      title: request.title,
      body: request.body,
      channels: request.channels?.length ? request.channels : ['in-app'],
      idempotencyKey: request.idempotencyKey,
      category: 'workflow',
      transactional: true,
      producerModuleId: 'workflow.notification',
      correlationId: request.correlationId,
      causationId: request.causationId,
      workflowInstanceId: request.workflowInstanceId,
      metadata: {
        ...(request.metadata ?? {}),
        workflowInstanceId: request.workflowInstanceId,
      },
    });
  }
}
