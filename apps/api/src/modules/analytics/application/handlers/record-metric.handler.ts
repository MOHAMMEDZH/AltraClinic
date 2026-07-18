import { Inject, Injectable } from '@nestjs/common';
import { RecordMetricCommand } from '../commands/record-metric.command';
import { MetricRepository } from '../../domain/repositories/metric.repository.interface';
import { Metric } from '../../domain/entities/metric.entity';
import { MetricName, MetricValue, DimensionFilter } from '../../domain/value-objects';
import { MetricRecordedEvent } from '../../domain/events/metric-recorded.event';
import { METRIC_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';

/**
 * Record Metric Handler
 * Executes RecordMetricCommand to record a new metric data point
 */
@Injectable()
export class RecordMetricHandler {
  constructor(
    @Inject(METRIC_REPOSITORY) private readonly repository: MetricRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(command: RecordMetricCommand): Promise<{ metricId: string }> {
    // Resolve metric name
    const metricName = MetricName.create(command.metricName);

    // Resolve metric value type and create value object
    let metricValue: MetricValue;
    if (typeof command.metricValue === 'number') {
      if (command.metricName.includes('percentage') || command.metricName.includes('rate')) {
        metricValue = MetricValue.percentage(command.metricValue as number);
      } else if (command.metricName.includes('count')) {
        metricValue = MetricValue.count(command.metricValue as number);
      } else if (command.metricName.includes('revenue')) {
        metricValue = MetricValue.currency(command.metricValue as number);
      } else {
        metricValue = MetricValue.ratio(command.metricValue as number);
      }
    } else {
      metricValue = MetricValue.text(command.metricValue);
    }

    // Build dimension filter
    const dimensionFilter = DimensionFilter.create(command.dimensions ?? {});

    // Create metric aggregate
    const metric = Metric.create({
      tenantId: command.tenantId,
      branchId: command.branchId,
      metricName,
      metricValue,
      dimensionFilter,
      timestamp: command.timestamp ? new Date(command.timestamp) : new Date(),
      recordedBy: command.recordedBy,
    });

    // Add tags if provided
    if (command.tags) {
      Object.entries(command.tags).forEach(([key, value]) => {
        metric.addTag(key, value);
      });
    }

    // Add metadata if provided
    if (command.metadata) {
      Object.entries(command.metadata).forEach(([key, value]) => {
        metric.addMetadata(key, value);
      });
    }

    // Save to repository
    await this.repository.save(metric);

    // Publish domain event
    const event = new MetricRecordedEvent(
      metric.metricId,
      metric.tenantId,
      metric.metricName.toString(),
      metric.metricValue.value,
      metric.recordedBy,
      dimensionFilter.toJSON() as Record<string, string>,
      metric.branchId,
    );
    await this.eventPublisher.publish(event);

    return { metricId: metric.metricId };
  }
}
