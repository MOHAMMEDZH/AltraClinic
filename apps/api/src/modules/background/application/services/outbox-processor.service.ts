import { Inject, Injectable, Logger } from '@nestjs/common';
import { DomainEventBus } from '../../../../infrastructure/domain-event-bus.service';
import { OUTBOX_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { OutboxRepository } from '../../../../infrastructure/outbox.repository.interface';
import { OutboxEventRehydratorService } from './outbox-event-rehydrator.service';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { LicensingExecutionGuard } from '../../../subscription/application/services/licensing-execution.guard';
import { LicensedModuleId } from '../../../subscription/domain/config/licensing.config';

export interface OutboxProcessResult {
  processed: number;
  failed: number;
  skipped: number;
}

@Injectable()
export class OutboxProcessorService {
  private readonly logger = new Logger(OutboxProcessorService.name);
  private readonly maxAttempts = 10;

  constructor(
    @Inject(OUTBOX_REPOSITORY) private readonly outboxRepository: OutboxRepository,
    private readonly rehydrator: OutboxEventRehydratorService,
    private readonly bus: DomainEventBus,
    private readonly prisma: PrismaService,
    private readonly licensing: LicensingExecutionGuard,
  ) {}

  async processPending(batchSize = 50): Promise<OutboxProcessResult> {
    const result: OutboxProcessResult = { processed: 0, failed: 0, skipped: 0 };

    const rows = await this.prisma.getRootClient().outboxEvent.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });

    for (const row of rows) {
      if (row.attempts >= this.maxAttempts) {
        result.skipped++;
        continue;
      }

      const payload = row.payload as Record<string, unknown>;
      const event = this.rehydrator.rehydrate(row.eventType, payload);

      if (!event) {
        await this.outboxRepository.markFailed(row.id, `Unknown event type: ${row.eventType}`);
        result.failed++;
        continue;
      }

      if (row.tenantId) {
        const moduleId = this.moduleForEvent(row.eventType);
        const allowed = await this.licensing.allowWorkerExecution({
          tenantId: row.tenantId,
          workerName: 'outbox-processor',
          moduleId,
          source: 'worker.outbox',
        });
        if (!allowed) {
          result.skipped++;
          continue;
        }
      }

      try {
        await this.bus.publish(event);
        await this.outboxRepository.markProcessed(row.id);
        result.processed++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.outboxRepository.markFailed(row.id, message);
        this.logger.error(`Outbox replay failed for ${row.id}: ${message}`);
        result.failed++;
      }
    }

    return result;
  }

  private moduleForEvent(eventType: string): LicensedModuleId {
    const type = eventType.toLowerCase();
    if (type.includes('workflow')) return 'workflow';
    if (type.includes('notification')) return 'notifications';
    if (type.includes('report') || type.includes('analytics')) return 'reporting';
    if (type.includes('appointment') || type.includes('scheduling')) return 'scheduling';
    if (type.includes('billing') || type.includes('invoice')) return 'billing';
    if (type.includes('ai')) return 'ai';
    if (type.includes('media')) return 'media';
    return 'settings';
  }
}
