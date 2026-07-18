import { Injectable } from '@nestjs/common';

import type { AiEnrichedContext, AiInferenceInput, AiInferenceResult } from '../ai-inference.types';



function parseFact(blocks: string[], prefix: string): Record<string, string> {

  const line = blocks.find((b) => b.startsWith(prefix));

  if (!line) return {};

  const out: Record<string, string> = {};

  for (const part of line.split(/\s+/).slice(1)) {

    const [key, value] = part.split('=');

    if (key && value !== undefined) out[key] = value;

  }

  return out;

}



@Injectable()

export class TemplateAiProvider {

  async generate(

    input: AiInferenceInput,

    enriched: AiEnrichedContext,

    started: number,

  ): Promise<AiInferenceResult> {

    const content = this.composeResponse(input, enriched);



    return {

      content,

      citations: enriched.citations,

      tokenCount: Math.ceil(content.length / 4),

      latencyMs: Date.now() - started,

      provider: 'template',

      model: 'template-v1',

    };

  }



  async *stream(

    input: AiInferenceInput,

    enriched: AiEnrichedContext,

    started: number,

  ): AsyncGenerator<string, AiInferenceResult, void> {

    const result = await this.generate(input, enriched, started);

    const chunk = 48;

    for (let i = 0; i < result.content.length; i += chunk) {

      yield result.content.slice(i, i + chunk);

    }

    return result;

  }



  private composeResponse(input: AiInferenceInput, enriched: AiEnrichedContext): string {

    const ar = Boolean(input.locale?.startsWith('ar'));

    const body = this.buildAnswer(input, enriched, ar);

    const footer = ar

      ? '\n\n---\n*مساعد العيادة المدمج — تحقق من البيانات في النظام قبل اتخاذ قرار.*'

      : '\n\n---\n*Built-in clinic assistant — verify facts in the ERP before acting.*';

    return body + footer;

  }



  private buildAnswer(input: AiInferenceInput, enriched: AiEnrichedContext, ar: boolean): string {

    const msg = input.userMessage;

    const blocks = enriched.contextBlocks;

    const priorTurns = enriched.history.filter((h) => h.role === 'assistant').length;



    const usage = parseFact(blocks, 'AI usage snapshot:');

    if (Object.keys(usage).length > 0 && this.matchesUsagePrompt(msg)) {

      return ar ? this.formatUsageAr(usage) : this.formatUsageEn(usage);

    }



    const dashboard = parseFact(blocks, 'Dashboard snapshot:');

    if (Object.keys(dashboard).length > 0 && this.matchesDashboardPrompt(msg)) {

      return ar ? this.formatDashboardAr(dashboard) : this.formatDashboardEn(dashboard);

    }



    if (priorTurns > 0) {

      return ar

        ? `متابعة لسؤالك «${msg}»:\n\n${this.workspaceGuidance(input.workspaceId, msg, ar, blocks)}`

        : `Follow-up on «${msg}»:\n\n${this.workspaceGuidance(input.workspaceId, msg, ar, blocks)}`;

    }



    return this.workspaceGuidance(input.workspaceId, msg, ar, blocks);

  }



  private matchesUsagePrompt(text: string): boolean {

    return /usage|token|active user|مستخدم|رموز|استهلاك|ذكاء|مساعد|tenant/i.test(text);

  }



  private matchesDashboardPrompt(text: string): boolean {

    return /dashboard|kpi|indicator|metric|لوحة|مؤشر|مؤشرات/i.test(text);

  }



  private formatUsageEn(usage: Record<string, string>): string {

    return [

      '**AI usage summary (this tenant)**',

      `- Total messages: **${usage.totalMessages ?? '0'}**`,

      `- Total tokens: **${usage.totalTokens ?? '0'}**`,

      `- Successful inferences: **${usage.successes ?? '0'}** · Failures: **${usage.failures ?? '0'}**`,

      `- Active users (14 days): **${usage.activeUsers14d ?? '0'}**`,

      `- Today: **${usage.messagesToday ?? '0'}** messages · **${usage.tokensToday ?? '0'}** tokens`,

    ].join('\n');

  }



  private formatUsageAr(usage: Record<string, string>): string {

    return [

      '**ملخص استخدام الذكاء الاصطناعي (هذا المستأجر)**',

      `- إجمالي الرسائل: **${usage.totalMessages ?? '0'}**`,

      `- إجمالي الرموز (tokens): **${usage.totalTokens ?? '0'}**`,

      `- عمليات ناجحة: **${usage.successes ?? '0'}** · فاشلة: **${usage.failures ?? '0'}**`,

      `- مستخدمون نشطون (14 يوماً): **${usage.activeUsers14d ?? '0'}**`,

      `- اليوم: **${usage.messagesToday ?? '0'}** رسالة · **${usage.tokensToday ?? '0'}** رمز`,

    ].join('\n');

  }



  private formatDashboardEn(snapshot: Record<string, string>): string {

    return [

      '**Dashboard KPI overview**',

      `- Registered patients: **${snapshot.patients ?? '0'}**`,

      `- Appointments today: **${snapshot.appointmentsToday ?? '0'}**`,

      `- Collected revenue (month to date): **${snapshot.revenueMonth ?? '0'}**`,

      `- Outstanding receivables: **${snapshot.outstanding ?? '0'}**`,

      '',

      'Open **Dashboard** for trends, branch filters, and drill-down charts.',

    ].join('\n');

  }



  private formatDashboardAr(snapshot: Record<string, string>): string {

    return [

      '**نظرة على مؤشرات اللوحة**',

      `- المرضى المسجلون: **${snapshot.patients ?? '0'}**`,

      `- مواعيد اليوم: **${snapshot.appointmentsToday ?? '0'}**`,

      `- الإيرادات المحصلة (منذ بداية الشهر): **${snapshot.revenueMonth ?? '0'}**`,

      `- المبالغ المستحقة: **${snapshot.outstanding ?? '0'}**`,

      '',

      'افتح **لوحة التحكم** للاتجاهات والفلاتر والرسوم التفصيلية.',

    ].join('\n');

  }



  private workspaceGuidance(

    workspaceId: string | null | undefined,

    userMessage: string,

    ar: boolean,

    blocks: string[],

  ): string {

    const hasPatient = blocks.some((b) => b.startsWith('Patient:'));

    const topic = userMessage.length > 160 ? `${userMessage.slice(0, 160)}…` : userMessage;



    if (workspaceId === 'medical' || workspaceId === 'dental' || workspaceId === 'beauty') {

      return ar

        ? `بخصوص «${topic}»:\n- راجع الحساسيات والمشاكل النشطة وآخر زيارة.\n${hasPatient ? '- بيانات المريض مرفقة في السياق.' : '- اربط ملف مريض للحصول على سياق أغنى.'}`

        : `For «${topic}»:\n- Review allergies, active problems, and the latest encounter.\n${hasPatient ? '- Patient context is attached.' : '- Link a patient chart for richer context.'}`;

    }

    if (workspaceId === 'billing') {

      return ar

        ? `بخصوص «${topic}»:\n- راجع بنود الفاتورة والمدفوعات والرصيد المفتوح.`

        : `For «${topic}»:\n- Cross-check invoice lines, payments, and outstanding balance.`;

    }

    if (workspaceId === 'reporting' || workspaceId === 'analytics') {

      return ar

        ? `بخصوص «${topic}»:\n- حدد نطاق التاريخ والفرع ثم صدّر التقرير المناسب.`

        : `For «${topic}»:\n- Set date range and branch, then export the relevant report.`;

    }

    return ar

      ? `بخصوص «${topic}»:\n- تحقق من السجلات المرتبطة في النظام قبل التنفيذ.\n- للإجابات الأغنى، افتح المريض/الموعد/الفاتورة ذات الصلة ثم أعد السؤال.`

      : `Regarding «${topic}»:\n- Validate against linked ERP records before acting.\n- For richer answers, open the relevant patient/appointment/invoice and ask again.`;

  }

}


