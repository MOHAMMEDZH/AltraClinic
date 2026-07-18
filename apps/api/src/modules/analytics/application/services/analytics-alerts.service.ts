import { Injectable } from '@nestjs/common';
import type { DashboardOverviewDto } from '../../../dashboard/application/dashboard-overview.service';

export interface AnalyticsAlertDto {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  titleKey: string;
  messageKey: string;
  domainId?: string;
  metricId?: string;
  value?: number;
  threshold?: number;
}

@Injectable()
export class AnalyticsAlertsService {
  computeAlerts(overview: DashboardOverviewDto): AnalyticsAlertDto[] {
    const alerts: AnalyticsAlertDto[] = [];
    const bh = overview.businessHealth;

    if (bh.noShowPercent > 15) {
      alerts.push({
        id: 'high-no-show',
        severity: 'warning',
        titleKey: 'analytics.alerts.highNoShow.title',
        messageKey: 'analytics.alerts.highNoShow.message',
        domainId: 'operations',
        metricId: 'noShow',
        value: bh.noShowPercent,
        threshold: 15,
      });
    }
    if (bh.collectionPercent < 70) {
      alerts.push({
        id: 'low-collection',
        severity: 'warning',
        titleKey: 'analytics.alerts.lowCollection.title',
        messageKey: 'analytics.alerts.lowCollection.message',
        domainId: 'financial',
        metricId: 'collection',
        value: bh.collectionPercent,
        threshold: 70,
      });
    }
    if (overview.kpis.outstandingAmount > overview.kpis.revenueMonth * 0.3 && overview.kpis.revenueMonth > 0) {
      alerts.push({
        id: 'high-outstanding',
        severity: 'critical',
        titleKey: 'analytics.alerts.highOutstanding.title',
        messageKey: 'analytics.alerts.highOutstanding.message',
        domainId: 'financial',
        metricId: 'outstanding',
        value: overview.kpis.outstandingAmount,
      });
    }
    if (bh.utilizationPercent < 50) {
      alerts.push({
        id: 'low-utilization',
        severity: 'info',
        titleKey: 'analytics.alerts.lowUtilization.title',
        messageKey: 'analytics.alerts.lowUtilization.message',
        domainId: 'operations',
        metricId: 'utilization',
        value: bh.utilizationPercent,
        threshold: 50,
      });
    }
    if (overview.kpis.lowStockCount > 0) {
      alerts.push({
        id: 'inventory-risk',
        severity: 'warning',
        titleKey: 'analytics.alerts.inventoryRisk.title',
        messageKey: 'analytics.alerts.inventoryRisk.message',
        domainId: 'inventory',
        metricId: 'lowStock',
        value: overview.kpis.lowStockCount,
      });
    }

    return alerts;
  }
}
