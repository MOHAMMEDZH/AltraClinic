import { Injectable } from '@nestjs/common';
import type {
  AiCitation,
  AiEnrichedContext,
  AiInferenceAttachment,
  AiInferenceInput,
  AiUserPreferences,
} from './ai-inference.types';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import {
  inferAiModule,
  inferAnalyticsDomain,
  inferInventoryItemId,
  inferReportId,
} from '../../domain/config/ai-route-context.config';
import { resolveReportContext } from './ai-report-context.util';

@Injectable()
export class AiContextService {
  constructor(private readonly prisma: PrismaService) {}

  async enrich(input: AiInferenceInput): Promise<AiEnrichedContext> {
    const context = input.context ?? {};
    const citations: AiCitation[] = [];
    const blocks: string[] = [];

    const patientBlock = await this.loadPatientBlock(input.tenantId, context, citations);
    if (patientBlock) blocks.push(patientBlock);

    const encounterBlock = await this.loadEncounterBlock(input.tenantId, context, citations);
    if (encounterBlock) blocks.push(encounterBlock);

    const invoiceBlock = await this.loadInvoiceBlock(input.tenantId, context, citations);
    if (invoiceBlock) blocks.push(invoiceBlock);

    const appointmentBlock = await this.loadAppointmentBlock(input.tenantId, context, citations);
    if (appointmentBlock) blocks.push(appointmentBlock);

    const workflowBlock = await this.loadWorkflowBlock(input.tenantId, context, citations);
    if (workflowBlock) blocks.push(workflowBlock);

    const inventoryBlock = await this.loadInventoryBlock(input.tenantId, context, citations);
    if (inventoryBlock) blocks.push(inventoryBlock);

    const dentalBlock = await this.loadDentalBlock(input.tenantId, context, citations);
    if (dentalBlock) blocks.push(dentalBlock);

    const beautyBlock = await this.loadBeautyBlock(input.tenantId, context, citations);
    if (beautyBlock) blocks.push(beautyBlock);

    const moduleBlock = this.loadModuleBlock(context);
    if (moduleBlock) blocks.push(moduleBlock);

    const reportBlock = await this.loadReportBlock(input.tenantId, context, citations);
    if (reportBlock) blocks.push(reportBlock);

    const aiUsageBlock = await this.maybeLoadAiUsageBlock(input.tenantId, context, input.userMessage);
    if (aiUsageBlock) blocks.push(aiUsageBlock);

    const dashboardBlock = await this.maybeLoadDashboardSnapshotBlock(input.tenantId, context, input.userMessage);
    if (dashboardBlock) blocks.push(dashboardBlock);

    if (context.path) blocks.push(`Current route: ${context.path}`);

    const history = input.conversationId
      ? await this.loadHistory(input.tenantId, input.conversationId, input.preferences)
      : [];

    const attachmentNote = this.describeAttachments(input.attachments);
    if (attachmentNote) blocks.push(attachmentNote);

    const systemPrompt = [
      'You are a healthcare ERP assistant for medical, dental, and beauty clinics.',
      'Be concise, actionable, and cautious. Never invent clinical data. State when context is missing.',
      input.workspaceId ? `Workspace: ${input.workspaceId}.` : '',
      input.locale ? `Respond in locale: ${input.locale}.` : '',
      blocks.length ? `Context:\n${blocks.join('\n\n')}` : 'No module context linked.',
      history.length ? 'Use prior conversation turns for continuity.' : '',
    ]
      .filter(Boolean)
      .join('\n');

    const userParts = this.buildUserParts(input.userMessage, input.attachments);

    return { systemPrompt, contextBlocks: blocks, citations, history, userParts };
  }

  private async loadPatientBlock(
    tenantId: string,
    context: Record<string, unknown>,
    citations: AiCitation[],
  ): Promise<string | null> {
    const patientId = typeof context.patientId === 'string' ? context.patientId : null;
    if (!patientId) return null;

    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        nationalId: true,
        dateOfBirth: true,
        gender: true,
        bloodGroup: true,
        profileData: true,
      },
    });
    if (!patient) return null;

    citations.push({ label: 'Patient record', resourceType: 'patient', resourceId: patient.id });
    const profile = (patient.profileData as Record<string, unknown>) ?? {};
    const allergies = Array.isArray(profile.allergies) ? profile.allergies.join(', ') : 'none documented';

    const encounters = await this.prisma.encounter.findMany({
      where: { tenantId, patientId: patient.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, status: true, chiefComplaint: true, createdAt: true },
    });
    encounters.forEach((enc) =>
      citations.push({
        label: `Encounter ${enc.createdAt.toISOString().slice(0, 10)}`,
        resourceType: 'encounter',
        resourceId: enc.id,
      }),
    );

    return [
      `Patient: ${patient.firstName} ${patient.lastName}`,
      `ID: ${patient.nationalId ?? patient.id.slice(0, 8)} · DOB: ${patient.dateOfBirth?.toISOString().slice(0, 10) ?? '—'}`,
      `Gender: ${patient.gender ?? '—'} · Blood group: ${patient.bloodGroup ?? '—'}`,
      `Allergies: ${allergies}`,
      `Recent encounters: ${encounters.map((e) => `${e.createdAt.toISOString().slice(0, 10)} ${e.chiefComplaint ?? e.status}`).join('; ') || 'none'}`,
    ].join('\n');
  }

  private async loadEncounterBlock(
    tenantId: string,
    context: Record<string, unknown>,
    citations: AiCitation[],
  ): Promise<string | null> {
    const encounterId = typeof context.encounterId === 'string' ? context.encounterId : null;
    if (!encounterId) return null;

    const encounter = await this.prisma.encounter.findFirst({
      where: { id: encounterId, tenantId },
      select: {
        id: true,
        status: true,
        chiefComplaint: true,
        structuredNotes: true,
        soapNotes: true,
        createdAt: true,
      },
    });
    if (!encounter) return null;

    const notesExcerpt = this.encounterNotesExcerpt(encounter.structuredNotes, encounter.soapNotes);

    citations.push({ label: 'Current encounter', resourceType: 'encounter', resourceId: encounter.id });
    return [
      `Encounter: ${encounter.id.slice(0, 8)} · Status: ${encounter.status}`,
      `Chief complaint: ${encounter.chiefComplaint ?? '—'}`,
      `Clinical notes excerpt: ${notesExcerpt}`,
    ].join('\n');
  }

  private encounterNotesExcerpt(structuredNotes: unknown, soapNotes: unknown): string {
    if (Array.isArray(structuredNotes) && structuredNotes.length > 0) {
      const first = structuredNotes[0] as { body?: string; title?: string };
      const text = first.body ?? first.title ?? '';
      if (text) return text.slice(0, 500);
    }
    if (soapNotes && typeof soapNotes === 'object') {
      const soap = soapNotes as Record<string, string>;
      const combined = ['subjective', 'objective', 'assessment', 'plan']
        .map((k) => soap[k])
        .filter(Boolean)
        .join(' ');
      if (combined) return combined.slice(0, 500);
    }
    return '—';
  }

  private async loadInvoiceBlock(
    tenantId: string,
    context: Record<string, unknown>,
    citations: AiCitation[],
  ): Promise<string | null> {
    const invoiceId = typeof context.invoiceId === 'string' ? context.invoiceId : null;
    if (!invoiceId) return null;

    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        amountTotal: true,
        amountPaid: true,
      },
    });
    if (!invoice) return null;

    const amountDue = Number(invoice.amountTotal) - Number(invoice.amountPaid);

    citations.push({ label: 'Invoice', resourceType: 'invoice', resourceId: invoice.id });
    return [
      `Invoice ${invoice.invoiceNumber} · Status: ${invoice.status}`,
      `Total: ${invoice.amountTotal} · Paid: ${invoice.amountPaid} · Due: ${amountDue}`,
    ].join('\n');
  }

  private async loadAppointmentBlock(
    tenantId: string,
    context: Record<string, unknown>,
    citations: AiCitation[],
  ): Promise<string | null> {
    const appointmentId = typeof context.appointmentId === 'string' ? context.appointmentId : null;
    if (!appointmentId) return null;

    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId, deletedAt: null },
      select: {
        id: true,
        scheduledStart: true,
        scheduledEnd: true,
        status: true,
        serviceType: true,
        notes: true,
        patient: { select: { firstName: true, lastName: true } },
      },
    });
    if (!appointment) return null;

    citations.push({ label: 'Appointment', resourceType: 'appointment', resourceId: appointment.id });
    return [
      `Appointment: ${appointment.scheduledStart.toISOString()} – ${appointment.scheduledEnd.toISOString()}`,
      `Patient: ${appointment.patient.firstName} ${appointment.patient.lastName}`,
      `Status: ${appointment.status} · Service: ${appointment.serviceType ?? '—'}`,
      `Notes: ${appointment.notes ?? '—'}`,
    ].join('\n');
  }

  private async loadWorkflowBlock(
    tenantId: string,
    context: Record<string, unknown>,
    citations: AiCitation[],
  ): Promise<string | null> {
    const workflowId = typeof context.workflowId === 'string' ? context.workflowId : null;
    if (!workflowId) return null;

    const workflow = await this.prisma.workflow.findFirst({
      where: { id: workflowId, tenantId },
      select: {
        id: true,
        nameEn: true,
        status: true,
        currentStepIndex: true,
        steps: true,
        dueAt: true,
      },
    });
    if (!workflow) return null;

    citations.push({ label: 'Workflow', resourceType: 'workflow', resourceId: workflow.id });
    const step = workflow.steps[workflow.currentStepIndex] ?? `Step ${workflow.currentStepIndex + 1}`;
    return [
      `Workflow: ${workflow.nameEn}`,
      `Status: ${workflow.status} · Current step: ${step}`,
      `Due: ${workflow.dueAt?.toISOString() ?? '—'}`,
    ].join('\n');
  }

  private async loadInventoryBlock(
    tenantId: string,
    context: Record<string, unknown>,
    citations: AiCitation[],
  ): Promise<string | null> {
    const path = typeof context.path === 'string' ? context.path : '';
    const itemId =
      typeof context.inventoryItemId === 'string'
        ? context.inventoryItemId
        : inferInventoryItemId(path) ?? null;
    if (!itemId) return null;

    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId, tenantId, deletedAt: null },
      select: {
        id: true,
        sku: true,
        nameEn: true,
        quantityOnHand: true,
        reorderThreshold: true,
        unit: true,
        expiryDate: true,
      },
    });
    if (!item) return null;

    citations.push({ label: 'Inventory item', resourceType: 'inventory_item', resourceId: item.id });
    return [
      `Inventory item: ${item.nameEn} (${item.sku})`,
      `On hand: ${item.quantityOnHand} ${item.unit} · Reorder at: ${item.reorderThreshold}`,
      `Expiry: ${item.expiryDate?.toISOString().slice(0, 10) ?? '—'}`,
    ].join('\n');
  }

  private async loadDentalBlock(
    tenantId: string,
    context: Record<string, unknown>,
    citations: AiCitation[],
  ): Promise<string | null> {
    const module = typeof context.module === 'string' ? context.module : inferAiModule(String(context.path ?? ''));
    const patientId =
      typeof context.dentalPatientId === 'string'
        ? context.dentalPatientId
        : module === 'dental' && typeof context.patientId === 'string'
          ? context.patientId
          : null;
    if (!patientId) return null;

    const record = await this.prisma.dentalRecord.findFirst({
      where: { tenantId, patientId },
      select: { id: true, odontogramMode: true, updatedAt: true },
    });
    if (!record) return null;

    citations.push({ label: 'Dental chart', resourceType: 'dental_record', resourceId: record.id });
    return `Dental record: ${record.odontogramMode} chart · Updated ${record.updatedAt.toISOString().slice(0, 10)}`;
  }

  private async loadBeautyBlock(
    tenantId: string,
    context: Record<string, unknown>,
    citations: AiCitation[],
  ): Promise<string | null> {
    const module = typeof context.module === 'string' ? context.module : inferAiModule(String(context.path ?? ''));
    const patientId =
      typeof context.beautyPatientId === 'string'
        ? context.beautyPatientId
        : module === 'beauty' && typeof context.patientId === 'string'
          ? context.patientId
          : null;
    if (!patientId) return null;

    const record = await this.prisma.beautyRecord.findFirst({
      where: { tenantId, patientId },
      include: { annotations: { orderBy: { recordedAt: 'desc' }, take: 3 } },
    });
    if (!record) return null;

    citations.push({ label: 'Beauty record', resourceType: 'beauty_record', resourceId: record.id });
    const sessions =
      record.annotations.map((a) => `${a.zone}: ${a.treatment}`).join('; ') || 'no recent sessions';
    return `Beauty record · Recent sessions: ${sessions}`;
  }

  private loadModuleBlock(context: Record<string, unknown>): string | null {
    const path = typeof context.path === 'string' ? context.path : '';
    const module =
      typeof context.module === 'string' ? context.module : path ? inferAiModule(path) : null;
    if (!module) return null;

    const lines = [`Active module: ${module}`];
    const analyticsDomain =
      typeof context.analyticsDomain === 'string'
        ? context.analyticsDomain
        : inferAnalyticsDomain(path) ?? null;
    if (analyticsDomain) lines.push(`Analytics domain: ${analyticsDomain}`);
    else if (module === 'analytics') lines.push('Analytics view: overview');
    return lines.join('\n');
  }

  private async loadReportBlock(
    tenantId: string,
    context: Record<string, unknown>,
    citations: AiCitation[],
  ): Promise<string | null> {
    const path = typeof context.path === 'string' ? context.path : '';
    const reportId =
      typeof context.reportId === 'string' ? context.reportId : inferReportId(path) ?? null;
    if (!reportId) return null;

    const report = await resolveReportContext(this.prisma, tenantId, reportId);
    citations.push({ label: 'Report', resourceType: 'report', resourceId: reportId });
    return [
      `Report: ${report.label}`,
      report.type ? `Type: ${report.type}` : '',
      report.status ? `Status: ${report.status}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private async loadHistory(
    tenantId: string,
    conversationId: string,
    preferences?: AiUserPreferences,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    if (preferences?.saveHistory === false) return [];

    const rows = await this.prisma.aiMessage.findMany({
      where: { tenantId, conversationId },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { role: true, content: true },
    });

    return rows
      .filter((r) => r.role === 'user' || r.role === 'assistant')
      .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }));
  }

  private describeAttachments(attachments?: AiInferenceAttachment[]): string | null {
    if (!attachments?.length) return null;
    const lines = attachments.map((a) => `- ${a.name} (${a.mimeType})`);
    return `User attachments:\n${lines.join('\n')}`;
  }

  private buildUserParts(
    userMessage: string,
    attachments?: AiInferenceAttachment[],
  ): AiEnrichedContext['userParts'] {
    const parts: AiEnrichedContext['userParts'] = [{ text: userMessage }];

    for (const file of attachments ?? []) {
      if (file.dataUrl?.startsWith('data:image/')) {
        const [, meta, data] = file.dataUrl.match(/^data:([^;]+);base64,(.+)$/) ?? [];
        if (meta && data) {
          parts.push({ inlineData: { mimeType: meta, data } });
          continue;
        }
      }
      parts.push({ text: `[Attachment: ${file.name} (${file.mimeType})]` });
    }

    return parts;
  }

  private async maybeLoadAiUsageBlock(
    tenantId: string,
    context: Record<string, unknown>,
    userMessage: string,
  ): Promise<string | null> {
    const module =
      typeof context.module === 'string'
        ? context.module
        : inferAiModule(String(context.path ?? ''));
    const text = userMessage.toLowerCase();
    const wantsUsage =
      module === 'ai' ||
      module === 'admin' ||
      /usage|token|active user|مستخدم|رموز|استهلاك|ذكاء|مساعد/.test(text);
    if (!wantsUsage) return null;

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 13);
    since.setUTCHours(0, 0, 0, 0);
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const [aggregate, activeUsers, todayAgg] = await Promise.all([
      this.prisma.aiUsageDaily.aggregate({
        where: { tenantId },
        _sum: { tokenCount: true, messageCount: true, successCount: true, failureCount: true },
      }),
      this.prisma.aiUsageDaily.groupBy({
        by: ['userId'],
        where: { tenantId, usageDate: { gte: since } },
      }),
      this.prisma.aiUsageDaily.aggregate({
        where: { tenantId, usageDate: startOfDay },
        _sum: { tokenCount: true, messageCount: true },
      }),
    ]);

    return [
      'AI usage snapshot:',
      `totalMessages=${aggregate._sum.messageCount ?? 0}`,
      `totalTokens=${aggregate._sum.tokenCount ?? 0}`,
      `successes=${aggregate._sum.successCount ?? 0}`,
      `failures=${aggregate._sum.failureCount ?? 0}`,
      `activeUsers14d=${activeUsers.length}`,
      `messagesToday=${todayAgg._sum.messageCount ?? 0}`,
      `tokensToday=${todayAgg._sum.tokenCount ?? 0}`,
    ].join(' ');
  }

  private async maybeLoadDashboardSnapshotBlock(
    tenantId: string,
    context: Record<string, unknown>,
    userMessage: string,
  ): Promise<string | null> {
    const module =
      typeof context.module === 'string'
        ? context.module
        : inferAiModule(String(context.path ?? ''));
    const text = userMessage.toLowerCase();
    const wantsDashboard =
      module === 'dashboard' ||
      module === 'analytics' ||
      /dashboard|kpi|indicator|metric|لوحة|مؤشر|مؤشرات/.test(text);
    if (!wantsDashboard) return null;

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const startOfMonth = new Date(Date.UTC(startOfDay.getUTCFullYear(), startOfDay.getUTCMonth(), 1));

    const [patients, appointmentsToday, revenueMonth, outstanding] = await Promise.all([
      this.prisma.patient.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.appointment.count({
        where: { tenantId, deletedAt: null, scheduledStart: { gte: startOfDay } },
      }),
      this.prisma.invoice.aggregate({
        where: {
          tenantId,
          deletedAt: null,
          invoiceDate: { gte: startOfMonth },
          status: { notIn: ['CANCELLED', 'DRAFT'] },
        },
        _sum: { amountPaid: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          tenantId,
          deletedAt: null,
          status: { in: ['ISSUED', 'PARTIAL_PAID', 'OVERDUE'] },
        },
        _sum: { amountTotal: true, amountPaid: true },
      }),
    ]);

    const collected = Number(revenueMonth._sum.amountPaid ?? 0);
    const due =
      Number(outstanding._sum.amountTotal ?? 0) - Number(outstanding._sum.amountPaid ?? 0);

    return [
      'Dashboard snapshot:',
      `patients=${patients}`,
      `appointmentsToday=${appointmentsToday}`,
      `revenueMonth=${collected}`,
      `outstanding=${due}`,
    ].join(' ');
  }
}
