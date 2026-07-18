import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import {
  inferAiModule,
  inferAnalyticsDomain,
  inferInventoryItemId,
  inferReportId,
  type AiRouteContextInput,
} from '../../domain/config/ai-route-context.config';
import { resolveReportContext } from './ai-report-context.util';

export interface AiContextSummaryItemDto {
  key: string;
  labelKey: string;
  value: string;
  resourceType?: string;
  resourceId?: string;
}

export interface AiContextSummaryDto {
  module: string;
  moduleLabelKey: string;
  items: AiContextSummaryItemDto[];
}

@Injectable()
export class AiContextSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async summarize(
    tenantId: string,
    raw: AiRouteContextInput,
    locale?: string,
  ): Promise<AiContextSummaryDto> {
    const useAr = locale?.toLowerCase().startsWith('ar') ?? false;
    const path = raw.path ?? '';
    const module = raw.module ?? inferAiModule(path);
    const items: AiContextSummaryItemDto[] = [];

    const patientId = raw.patientId ?? raw.dentalPatientId ?? raw.beautyPatientId;
    if (patientId) {
      const patient = await this.prisma.patient.findFirst({
        where: { id: patientId, tenantId, deletedAt: null },
        select: { id: true, firstName: true, lastName: true, firstNameAr: true, lastNameAr: true },
      });
      if (patient) {
        const name = useAr
          ? [patient.firstNameAr ?? patient.firstName, patient.lastNameAr ?? patient.lastName].filter(Boolean).join(' ')
          : `${patient.firstName} ${patient.lastName}`;
        items.push({
          key: 'patient',
          labelKey: 'ai.context.entities.patient',
          value: name.trim(),
          resourceType: 'patient',
          resourceId: patient.id,
        });
      }
    }

    if (raw.encounterId) {
      const encounter = await this.prisma.encounter.findFirst({
        where: { id: raw.encounterId, tenantId },
        select: { id: true, status: true, chiefComplaint: true, createdAt: true },
      });
      if (encounter) {
        items.push({
          key: 'encounter',
          labelKey: 'ai.context.entities.encounter',
          value: `${encounter.createdAt.toISOString().slice(0, 10)} · ${encounter.chiefComplaint ?? encounter.status}`,
          resourceType: 'encounter',
          resourceId: encounter.id,
        });
      }
    }

    if (raw.appointmentId) {
      const appointment = await this.prisma.appointment.findFirst({
        where: { id: raw.appointmentId, tenantId, deletedAt: null },
        select: { id: true, scheduledStart: true, status: true, serviceType: true },
      });
      if (appointment) {
        items.push({
          key: 'appointment',
          labelKey: 'ai.context.entities.appointment',
          value: `${appointment.scheduledStart.toISOString().slice(0, 16).replace('T', ' ')} · ${appointment.serviceType ?? appointment.status}`,
          resourceType: 'appointment',
          resourceId: appointment.id,
        });
      }
    }

    if (raw.invoiceId) {
      const invoice = await this.prisma.invoice.findFirst({
        where: { id: raw.invoiceId, tenantId },
        select: { id: true, invoiceNumber: true, status: true, amountTotal: true },
      });
      if (invoice) {
        items.push({
          key: 'invoice',
          labelKey: 'ai.context.entities.invoice',
          value: `${invoice.invoiceNumber} · ${invoice.status} · ${invoice.amountTotal}`,
          resourceType: 'invoice',
          resourceId: invoice.id,
        });
      }
    }

    if (raw.workflowId) {
      const workflow = await this.prisma.workflow.findFirst({
        where: { id: raw.workflowId, tenantId },
        select: { id: true, nameEn: true, nameAr: true, status: true, currentStepIndex: true, steps: true },
      });
      if (workflow) {
        const name = useAr ? workflow.nameAr : workflow.nameEn;
        const step = workflow.steps[workflow.currentStepIndex] ?? `step ${workflow.currentStepIndex + 1}`;
        items.push({
          key: 'workflow',
          labelKey: 'ai.context.entities.workflow',
          value: `${name} · ${workflow.status} · ${step}`,
          resourceType: 'workflow',
          resourceId: workflow.id,
        });
      }
    }

    const inventoryItemId = raw.inventoryItemId ?? inferInventoryItemId(path);
    if (inventoryItemId) {
      const item = await this.prisma.inventoryItem.findFirst({
        where: { id: inventoryItemId, tenantId, deletedAt: null },
        select: { id: true, sku: true, nameEn: true, nameAr: true, quantityOnHand: true, unit: true },
      });
      if (item) {
        const name = useAr ? item.nameAr ?? item.nameEn : item.nameEn;
        items.push({
          key: 'inventoryItem',
          labelKey: 'ai.context.entities.inventoryItem',
          value: `${name} (${item.sku}) · ${item.quantityOnHand} ${item.unit}`,
          resourceType: 'inventory_item',
          resourceId: item.id,
        });
      }
    }

    const analyticsDomain = raw.analyticsDomain ?? inferAnalyticsDomain(path);
    if (analyticsDomain) {
      items.push({
        key: 'analytics',
        labelKey: 'ai.context.entities.analytics',
        value: analyticsDomain,
      });
    } else if (module === 'analytics') {
      items.push({
        key: 'analytics',
        labelKey: 'ai.context.entities.analyticsOverview',
        value: useAr ? 'نظرة عامة على التحليلات' : 'Analytics overview',
      });
    }

    const reportId = raw.reportId ?? inferReportId(path);
    if (reportId) {
      const report = await resolveReportContext(this.prisma, tenantId, reportId);
      items.push({
        key: 'report',
        labelKey: 'ai.context.entities.report',
        value: report.type ? `${report.label} · ${report.type}` : report.label,
        resourceType: 'report',
        resourceId: reportId,
      });
    }

    if (module === 'dental' && patientId) {
      const dental = await this.prisma.dentalRecord.findFirst({
        where: { tenantId, patientId },
        select: { id: true, odontogramMode: true, updatedAt: true },
      });
      if (dental) {
        items.push({
          key: 'dentalRecord',
          labelKey: 'ai.context.entities.dentalRecord',
          value: `${dental.odontogramMode} · ${dental.updatedAt.toISOString().slice(0, 10)}`,
          resourceType: 'dental_record',
          resourceId: dental.id,
        });
      }
    }

    if (module === 'beauty' && patientId) {
      const beauty = await this.prisma.beautyRecord.findFirst({
        where: { tenantId, patientId },
        include: { annotations: { orderBy: { recordedAt: 'desc' }, take: 1 } },
      });
      if (beauty) {
        const latest = beauty.annotations[0];
        items.push({
          key: 'beautyRecord',
          labelKey: 'ai.context.entities.beautyRecord',
          value: latest
            ? `${latest.zone} · ${latest.treatment}`
            : beauty.updatedAt.toISOString().slice(0, 10),
          resourceType: 'beauty_record',
          resourceId: beauty.id,
        });
      }
    }

    return {
      module,
      moduleLabelKey: `ai.context.modules.${module}`,
      items,
    };
  }
}
