import { Inject, Injectable } from '@nestjs/common';
import { CreateDashboardCommand, DashboardWidgetInput } from '../commands/create-dashboard.command';
import { DashboardRepository } from '../../domain/repositories/dashboard.repository.interface';
import { Dashboard, DashboardWidgetConfig } from '../../domain/entities/dashboard.entity';
import { DashboardCreatedEvent } from '../../domain/events/dashboard-created.event';
import { DASHBOARD_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { randomUUID } from 'crypto';

/**
 * Create Dashboard Handler
 * Executes CreateDashboardCommand to create a new analytics dashboard
 */
@Injectable()
export class CreateDashboardHandler {
  constructor(
    @Inject(DASHBOARD_REPOSITORY) private readonly repository: DashboardRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(command: CreateDashboardCommand): Promise<{ dashboardId: string }> {
    // Convert widget inputs to widget configs with IDs
    const widgets: DashboardWidgetConfig[] = command.widgets.map((widget: DashboardWidgetInput) => ({
      widgetId: randomUUID(),
      metricName: widget.metricName,
      title: widget.title,
      description: widget.description,
      position: widget.position,
      size: widget.size,
      chartType: widget.chartType,
      refreshInterval: widget.refreshInterval,
      dimensionFilters: widget.dimensionFilters,
    }));

    // Create dashboard aggregate
    const dashboard = Dashboard.create({
      tenantId: command.tenantId,
      branchId: command.branchId,
      name: command.name,
      description: command.description,
      dashboardType: command.dashboardType,
      widgets,
      createdBy: command.createdBy,
      isDefault: command.isDefault ?? false,
      isPublic: command.isPublic ?? false,
    });

    // Save to repository
    await this.repository.save(dashboard);

    // Publish domain event
    const event = new DashboardCreatedEvent(
      dashboard.dashboardId,
      dashboard.tenantId,
      dashboard.name,
      dashboard.dashboardType,
      dashboard.createdBy,
      dashboard.widgets.length,
      dashboard.branchId,
    );
    await this.eventPublisher.publish(event);

    return { dashboardId: dashboard.dashboardId };
  }
}
