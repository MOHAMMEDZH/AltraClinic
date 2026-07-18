import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { GlobalSearchHandler } from '../../../search/application/handlers/global-search.handler';
import { inferAiModule } from '../../domain/config/ai-route-context.config';
import { resolveSmartActions } from '../../domain/config/ai-smart-actions.config';
import type { AiSkillId } from '../../domain/config/ai-skill-registry.config';
import { extractPatientSearchQuery } from '../../domain/utils/ai-skill-query.util';
import type { AiCitation, AiEnrichedContext, AiInferenceInput } from './ai-inference.types';

const OUTSTANDING_STATUSES = ['ISSUED', 'PARTIAL_PAID', 'OVERDUE'] as const;

export interface AiSkillExecutionResult {
  content: string;
  citations: AiCitation[];
  skillId: AiSkillId;
}

@Injectable()
export class AiSkillExecutorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly globalSearch: GlobalSearchHandler,
  ) {}

  async execute(
    skillId: AiSkillId,
    input: AiInferenceInput,
    enriched: AiEnrichedContext,
  ): Promise<AiSkillExecutionResult> {
    const ar = Boolean(input.locale?.startsWith('ar'));

    switch (skillId) {
      case 'appointments.today':
        return this.appointmentsToday(input, ar);
      case 'patient.summary':
        return this.patientSummary(input, enriched, ar);
      case 'billing.outstanding':
        return this.billingOutstanding(input, ar);
      case 'search.patients':
        return this.searchPatients(input, ar);
      case 'dashboard.snapshot':
        return this.dashboardSnapshot(input, ar);
      case 'ai.usage':
        return this.aiUsage(input, ar);
      case 'app.help':
        return this.appHelp(input, ar);
      default:
        return {
          skillId,
          citations: enriched.citations,
          content: ar
            ? 'لم أتمكن من تنفيذ هذا الطلب. جرّب صياغة أخرى أو افتح السجل ذي الصلة.'
            : 'I could not run that request. Try another phrasing or open the relevant record.',
        };
    }
  }

  private async appointmentsToday(input: AiInferenceInput, ar: boolean): Promise<AiSkillExecutionResult> {
    const citations: AiCitation[] = [];
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    const branchId =
      typeof input.context?.branchId === 'string' ? input.context.branchId : undefined;
    const branchFilter = branchId ? { branchId } : {};

    const [total, rows] = await Promise.all([
      this.prisma.appointment.count({
        where: {
          tenantId: input.tenantId,
          deletedAt: null,
          scheduledStart: { gte: startOfDay, lt: endOfDay },
          ...branchFilter,
        },
      }),
      this.prisma.appointment.findMany({
        where: {
          tenantId: input.tenantId,
          deletedAt: null,
          scheduledStart: { gte: startOfDay, lt: endOfDay },
          ...branchFilter,
        },
        orderBy: { scheduledStart: 'asc' },
        take: 12,
        select: {
          id: true,
          scheduledStart: true,
          scheduledEnd: true,
          status: true,
          serviceType: true,
          patient: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    rows.forEach((row) => {
      citations.push({ label: 'Appointment', resourceType: 'appointment', resourceId: row.id });
      citations.push({ label: 'Patient', resourceType: 'patient', resourceId: row.patient.id });
    });

    const dateLabel = startOfDay.toISOString().slice(0, 10);
    const lines = ar
      ? [`**مواعيد اليوم (${dateLabel})**`, `- الإجمالي: **${total}** موعد`]
      : [`**Today's appointments (${dateLabel})**`, `- Total: **${total}** appointment(s)`];

    if (rows.length === 0) {
      lines.push(ar ? '- لا توجد مواعيد مجدولة اليوم.' : '- No appointments scheduled for today.');
    } else {
      lines.push('');
      for (const row of rows) {
        const time = row.scheduledStart.toISOString().slice(11, 16);
        const name = `${row.patient.firstName} ${row.patient.lastName}`;
        const service = row.serviceType ? ` · ${row.serviceType}` : '';
        lines.push(`- **${time}** — ${name} (${row.status})${service}`);
      }
      if (total > rows.length) {
        lines.push(
          ar
            ? `\n*يعرض ${rows.length} من ${total}. افتح **المواعيد** للقائمة الكاملة.*`
            : `\n*Showing ${rows.length} of ${total}. Open **Appointments** for the full list.*`,
        );
      }
    }

    return { skillId: 'appointments.today', content: lines.join('\n'), citations };
  }

  private async patientSummary(
    input: AiInferenceInput,
    enriched: AiEnrichedContext,
    ar: boolean,
  ): Promise<AiSkillExecutionResult> {
    const patientId =
      typeof input.context?.patientId === 'string' ? input.context.patientId : null;

    if (!patientId) {
      const nameQuery = extractPatientSearchQuery(input.userMessage);
      if (nameQuery) {
        return this.searchPatients(input, ar);
      }
      return {
        skillId: 'patient.summary',
        citations: enriched.citations,
        content: ar
          ? '**ملخص المريض**\n\nافتح ملف المريض من **المرضى** ثم اسأل «لخص المريض» للحصول على ملخص من بيانات النظام.'
          : '**Patient summary**\n\nOpen a patient chart from **Patients**, then ask «summarize patient» for a summary from live ERP data.',
      };
    }

    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId: input.tenantId, deletedAt: null },
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

    if (!patient) {
      return {
        skillId: 'patient.summary',
        citations: enriched.citations,
        content: ar ? 'لم يتم العثور على المريض في هذا المستأجر.' : 'Patient not found in this tenant.',
      };
    }

    const [encounters, appointments] = await Promise.all([
      this.prisma.encounter.findMany({
        where: { tenantId: input.tenantId, patientId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, status: true, chiefComplaint: true, createdAt: true },
      }),
      this.prisma.appointment.findMany({
        where: { tenantId: input.tenantId, patientId, deletedAt: null },
        orderBy: { scheduledStart: 'desc' },
        take: 3,
        select: { id: true, scheduledStart: true, status: true },
      }),
    ]);

    const citations: AiCitation[] = [
      { label: 'Patient record', resourceType: 'patient', resourceId: patient.id },
    ];
    encounters.forEach((e) =>
      citations.push({
        label: `Encounter ${e.createdAt.toISOString().slice(0, 10)}`,
        resourceType: 'encounter',
        resourceId: e.id,
      }),
    );

    const profile = (patient.profileData as Record<string, unknown>) ?? {};
    const allergies = Array.isArray(profile.allergies)
      ? profile.allergies.join(', ')
      : ar
        ? 'غير موثقة'
        : 'none documented';

    const lines = ar
      ? [
          `**ملخص المريض — ${patient.firstName} ${patient.lastName}**`,
          `- الهوية: ${patient.nationalId ?? patient.id.slice(0, 8)}`,
          `- تاريخ الميلاد: ${patient.dateOfBirth?.toISOString().slice(0, 10) ?? '—'} · الجنس: ${patient.gender ?? '—'}`,
          `- فصيلة الدم: ${patient.bloodGroup ?? '—'}`,
          `- الحساسيات: ${allergies}`,
          '',
          '**آخر الزيارات**',
        ]
      : [
          `**Patient summary — ${patient.firstName} ${patient.lastName}**`,
          `- ID: ${patient.nationalId ?? patient.id.slice(0, 8)}`,
          `- DOB: ${patient.dateOfBirth?.toISOString().slice(0, 10) ?? '—'} · Gender: ${patient.gender ?? '—'}`,
          `- Blood group: ${patient.bloodGroup ?? '—'}`,
          `- Allergies: ${allergies}`,
          '',
          '**Recent encounters**',
        ];

    if (encounters.length === 0) {
      lines.push(ar ? '- لا توجد زيارات مسجلة.' : '- No encounters on file.');
    } else {
      for (const enc of encounters) {
        const date = enc.createdAt.toISOString().slice(0, 10);
        lines.push(`- ${date}: ${enc.chiefComplaint ?? enc.status}`);
      }
    }

    lines.push('', ar ? '**المواعيد الأخيرة**' : '**Recent appointments**');
    if (appointments.length === 0) {
      lines.push(ar ? '- لا توجد مواعيد.' : '- No appointments.');
    } else {
      for (const appt of appointments) {
        lines.push(`- ${appt.scheduledStart.toISOString().slice(0, 16).replace('T', ' ')} (${appt.status})`);
      }
    }

    return { skillId: 'patient.summary', content: lines.join('\n'), citations };
  }

  private async billingOutstanding(input: AiInferenceInput, ar: boolean): Promise<AiSkillExecutionResult> {
    const citations: AiCitation[] = [];
    const branchId =
      typeof input.context?.branchId === 'string' ? input.context.branchId : undefined;
    const branchFilter = branchId ? { branchId } : {};
    const baseWhere = { tenantId: input.tenantId, deletedAt: null, ...branchFilter };

    const [outstandingAgg, overdueCount, topInvoices] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { ...baseWhere, status: { in: [...OUTSTANDING_STATUSES] } },
        _sum: { amountTotal: true, amountPaid: true },
        _count: true,
      }),
      this.prisma.invoice.count({ where: { ...baseWhere, status: 'OVERDUE' } }),
      this.prisma.invoice.findMany({
        where: { ...baseWhere, status: { in: [...OUTSTANDING_STATUSES] } },
        orderBy: { dueDate: 'asc' },
        take: 8,
        select: {
          id: true,
          invoiceNumber: true,
          amountTotal: true,
          amountPaid: true,
          currency: true,
          status: true,
          dueDate: true,
        },
      }),
    ]);

    topInvoices.forEach((inv) =>
      citations.push({ label: `Invoice ${inv.invoiceNumber}`, resourceType: 'invoice', resourceId: inv.id }),
    );

    const outstandingTotal = Number(outstandingAgg._sum.amountTotal ?? 0);
    const outstandingPaid = Number(outstandingAgg._sum.amountPaid ?? 0);
    const outstandingAmount = Math.max(0, outstandingTotal - outstandingPaid);
    const currency = topInvoices[0]?.currency ?? 'USD';

    const lines = ar
      ? [
          '**المستحقات والفواتير المفتوحة**',
          `- عدد الفواتير المفتوحة: **${outstandingAgg._count}**`,
          `- المبلغ المستحق: **${outstandingAmount.toFixed(2)} ${currency}**`,
          `- فواتير متأخرة: **${overdueCount}**`,
        ]
      : [
          '**Outstanding balances**',
          `- Open invoices: **${outstandingAgg._count}**`,
          `- Amount due: **${outstandingAmount.toFixed(2)} ${currency}**`,
          `- Overdue invoices: **${overdueCount}**`,
        ];

    if (topInvoices.length > 0) {
      lines.push('', ar ? '**أقدم المستحقات**' : '**Oldest open invoices**');
      for (const inv of topInvoices) {
        const due = inv.dueDate?.toISOString().slice(0, 10) ?? '—';
        const dueAmt = Math.max(0, inv.amountTotal.toNumber() - inv.amountPaid.toNumber());
        lines.push(`- ${inv.invoiceNumber}: **${dueAmt.toFixed(2)} ${inv.currency}** (${inv.status}, due ${due})`);
      }
    }

    lines.push(
      '',
      ar
        ? 'افتح **الفواتير** لتسجيل المدفوعات أو إرسال تذكيرات.'
        : 'Open **Invoices** to post payments or send reminders.',
    );

    return { skillId: 'billing.outstanding', content: lines.join('\n'), citations };
  }

  private appHelp(input: AiInferenceInput, ar: boolean): Promise<AiSkillExecutionResult> {
    const path = typeof input.context?.path === 'string' ? input.context.path : '';
    const module =
      typeof input.context?.module === 'string' ? input.context.module : path ? inferAiModule(path) : null;

    const ctx = {
      path,
      module: module ?? undefined,
      patientId: typeof input.context?.patientId === 'string' ? input.context.patientId : undefined,
      encounterId: typeof input.context?.encounterId === 'string' ? input.context.encounterId : undefined,
      invoiceId: typeof input.context?.invoiceId === 'string' ? input.context.invoiceId : undefined,
      appointmentId: typeof input.context?.appointmentId === 'string' ? input.context.appointmentId : undefined,
      workflowId: typeof input.context?.workflowId === 'string' ? input.context.workflowId : undefined,
      inventoryItemId:
        typeof input.context?.inventoryItemId === 'string' ? input.context.inventoryItemId : undefined,
      reportId: typeof input.context?.reportId === 'string' ? input.context.reportId : undefined,
    };

    const actions = resolveSmartActions(ctx, 4);
    const lines = ar
      ? [
          '**مساعد العيادة المدمج**',
          'أسئلتي مبنية على بيانات نظامك — بدون إنترنت خارجي.',
          '',
          '**يمكنني مساعدتك في:**',
          '- مواعيد اليوم والجدول',
          '- ملخص المريض (عند فتح ملف مريض)',
          '- البحث عن مريض بالاسم',
          '- المستحقات والفواتير المتأخرة',
          '- اختصارات الصفحة الحالية',
          '',
          '**اقتراحات لهذه الصفحة:**',
        ]
      : [
          '**Built-in clinic assistant**',
          'Answers come from your ERP data — no external AI APIs.',
          '',
          '**I can help with:**',
          "- Today's appointments and schedule",
          '- Patient chart summary (when a patient is open)',
          '- Patient search by name',
          '- Outstanding and overdue invoices',
          '- Shortcuts for your current page',
          '',
          '**Suggestions for this page:**',
        ];

    if (actions.length === 0) {
      lines.push(ar ? '- استخدم شريط الإجراءات الذكية أو لوحة الأوامر (Ctrl+Shift+K).' : '- Use the smart action bar or command palette (Ctrl+Shift+K).');
    } else {
      for (const action of actions) {
        lines.push(`- ${ar ? action.promptAr : action.promptEn}`);
      }
    }

    if (module) {
      lines.push('', ar ? `الوحدة النشطة: **${module}**` : `Active module: **${module}**`);
    }

    return Promise.resolve({ skillId: 'app.help', content: lines.join('\n'), citations: [] });
  }

  private async searchPatients(input: AiInferenceInput, ar: boolean): Promise<AiSkillExecutionResult> {
    const citations: AiCitation[] = [];
    const extracted = extractPatientSearchQuery(input.userMessage);
    const q = extracted ?? input.userMessage.replace(/^(find|search|open)\s+patient(s)?\s*/i, '').trim();

    if (q.length < 2) {
      return {
        skillId: 'search.patients',
        citations,
        content: ar
          ? '**بحث المرضى**\n\nاكتب اسم المريض، مثل: «ابحث عن مريض أحمد» أو «open patient Sara».'
          : '**Patient search**\n\nType a patient name, e.g. «find patient Ahmed» or «open patient Sara».',
      };
    }

    const userRoles = await this.loadUserRoles(input.userId);
    const branchId =
      typeof input.context?.branchId === 'string' ? input.context.branchId : undefined;

    const result = await this.globalSearch.execute({
      q,
      types: ['patient'],
      limit: 8,
      branchId,
      userRoles,
    });

    const patients = result.results.filter((r) => r.type === 'patient');
    patients.forEach((p) =>
      citations.push({ label: p.title, resourceType: 'patient', resourceId: p.id }),
    );

    const lines = ar
      ? [`**نتائج بحث المرضى — «${q}»**`, `- عُثر على **${result.total}** مطابق`]
      : [`**Patient search — «${q}»**`, `- Found **${result.total}** match(es)`];

    if (patients.length === 0) {
      lines.push(ar ? '- لا توجد نتائج. جرّب تهجئة أخرى أو جزءاً من الاسم.' : '- No matches. Try another spelling or partial name.');
    } else {
      lines.push('');
      for (const p of patients) {
        const sub = p.subtitle ? ` — ${p.subtitle}` : '';
        lines.push(`- **${p.title}**${sub} · [${ar ? 'فتح' : 'Open'}](${p.url})`);
      }
    }

    return { skillId: 'search.patients', content: lines.join('\n'), citations };
  }

  private async dashboardSnapshot(input: AiInferenceInput, ar: boolean): Promise<AiSkillExecutionResult> {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const startOfMonth = new Date(Date.UTC(startOfDay.getUTCFullYear(), startOfDay.getUTCMonth(), 1));

    const [patients, appointmentsToday, revenueMonth, outstanding] = await Promise.all([
      this.prisma.patient.count({ where: { tenantId: input.tenantId, deletedAt: null } }),
      this.prisma.appointment.count({
        where: { tenantId: input.tenantId, deletedAt: null, scheduledStart: { gte: startOfDay } },
      }),
      this.prisma.invoice.aggregate({
        where: {
          tenantId: input.tenantId,
          deletedAt: null,
          invoiceDate: { gte: startOfMonth },
          status: { notIn: ['CANCELLED', 'DRAFT'] },
        },
        _sum: { amountPaid: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          tenantId: input.tenantId,
          deletedAt: null,
          status: { in: ['ISSUED', 'PARTIAL_PAID', 'OVERDUE'] },
        },
        _sum: { amountTotal: true, amountPaid: true },
      }),
    ]);

    const collected = Number(revenueMonth._sum.amountPaid ?? 0);
    const due =
      Number(outstanding._sum.amountTotal ?? 0) - Number(outstanding._sum.amountPaid ?? 0);

    const content = ar
      ? [
          '**نظرة على مؤشرات اللوحة**',
          `- المرضى المسجلون: **${patients}**`,
          `- مواعيد اليوم: **${appointmentsToday}**`,
          `- الإيرادات المحصلة (منذ بداية الشهر): **${collected}**`,
          `- المبالغ المستحقة: **${due}**`,
          '',
          'افتح **لوحة التحكم** للاتجاهات والفلاتر والرسوم التفصيلية.',
        ].join('\n')
      : [
          '**Dashboard KPI overview**',
          `- Registered patients: **${patients}**`,
          `- Appointments today: **${appointmentsToday}**`,
          `- Collected revenue (month to date): **${collected}**`,
          `- Outstanding receivables: **${due}**`,
          '',
          'Open **Dashboard** for trends, branch filters, and drill-down charts.',
        ].join('\n');

    return { skillId: 'dashboard.snapshot', content, citations: [] };
  }

  private async aiUsage(input: AiInferenceInput, ar: boolean): Promise<AiSkillExecutionResult> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 13);
    since.setUTCHours(0, 0, 0, 0);
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const [aggregate, activeUsers, todayAgg] = await Promise.all([
      this.prisma.aiUsageDaily.aggregate({
        where: { tenantId: input.tenantId },
        _sum: { tokenCount: true, messageCount: true, successCount: true, failureCount: true },
      }),
      this.prisma.aiUsageDaily.groupBy({
        by: ['userId'],
        where: { tenantId: input.tenantId, usageDate: { gte: since } },
      }),
      this.prisma.aiUsageDaily.aggregate({
        where: { tenantId: input.tenantId, usageDate: startOfDay },
        _sum: { tokenCount: true, messageCount: true },
      }),
    ]);

    const content = ar
      ? [
          '**ملخص استخدام الذكاء الاصطناعي (هذا المستأجر)**',
          `- إجمالي الرسائل: **${aggregate._sum.messageCount ?? 0}**`,
          `- إجمالي الرموز (tokens): **${aggregate._sum.tokenCount ?? 0}**`,
          `- عمليات ناجحة: **${aggregate._sum.successCount ?? 0}** · فاشلة: **${aggregate._sum.failureCount ?? 0}**`,
          `- مستخدمون نشطون (14 يوماً): **${activeUsers.length}**`,
          `- اليوم: **${todayAgg._sum.messageCount ?? 0}** رسالة · **${todayAgg._sum.tokenCount ?? 0}** رمز`,
        ].join('\n')
      : [
          '**AI usage summary (this tenant)**',
          `- Total messages: **${aggregate._sum.messageCount ?? 0}**`,
          `- Total tokens: **${aggregate._sum.tokenCount ?? 0}**`,
          `- Successful inferences: **${aggregate._sum.successCount ?? 0}** · Failures: **${aggregate._sum.failureCount ?? 0}**`,
          `- Active users (14 days): **${activeUsers.length}**`,
          `- Today: **${todayAgg._sum.messageCount ?? 0}** messages · **${todayAgg._sum.tokenCount ?? 0}** tokens`,
        ].join('\n');

    return { skillId: 'ai.usage', content, citations: [] };
  }

  private async loadUserRoles(userId: string): Promise<string[]> {
    const rows = await this.prisma.userRoleAssignment.findMany({
      where: { userId },
      select: { role: true },
    });
    return rows.map((r) => r.role);
  }
}
