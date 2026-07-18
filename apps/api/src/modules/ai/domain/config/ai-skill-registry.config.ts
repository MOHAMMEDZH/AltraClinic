import type { AiPlanLimits } from './ai-plan-limits.config';
import type { AiWorkspaceFeature } from './ai-plan-limits.config';
import type { AiSmartActionContext } from './ai-smart-actions.config';
import { contextSatisfied, scoreCommandPhrase } from './ai-command-registry.config';

export type AiSkillId =
  | 'appointments.today'
  | 'patient.summary'
  | 'billing.outstanding'
  | 'search.patients'
  | 'dashboard.snapshot'
  | 'ai.usage'
  | 'app.help';

export interface AiSkillDef {
  id: AiSkillId;
  phrasesEn: string[];
  phrasesAr: string[];
  priority: number;
  workspace?: AiWorkspaceFeature;
  requiresContext?: Array<keyof AiSmartActionContext>;
}

export const AI_SKILL_REGISTRY: AiSkillDef[] = [
  {
    id: 'appointments.today',
    phrasesEn: [
      'appointments today',
      "today's appointments",
      'today schedule',
      'schedule today',
      'who is scheduled today',
      'how many appointments today',
    ],
    phrasesAr: ['مواعيد اليوم', 'جدول اليوم', 'من المجدول اليوم'],
    priority: 88,
    workspace: 'reception',
  },
  {
    id: 'patient.summary',
    phrasesEn: [
      'patient summary',
      'summarize patient',
      'summarize this patient',
      'patient chart summary',
      'summarize chart',
    ],
    phrasesAr: ['ملخص المريض', 'لخص المريض', 'تلخيص المريض', 'ملخص الملف'],
    priority: 92,
    workspace: 'medical',
  },
  {
    id: 'search.patients',
    phrasesEn: [
      'find patient',
      'search patient',
      'open patient',
      'look up patient',
      'patient search',
    ],
    phrasesAr: ['ابحث عن مريض', 'اعثر على مريض', 'افتح مريض', 'بحث مريض'],
    priority: 90,
    workspace: 'medical',
  },
  {
    id: 'billing.outstanding',
    phrasesEn: [
      'outstanding balances',
      'outstanding invoices',
      'overdue invoices',
      'unpaid invoices',
      'accounts receivable',
      'what is owed',
      'summarize overdue invoices',
    ],
    phrasesAr: ['المستحقات', 'الفواتير المتأخرة', 'فواتير غير مدفوعة', 'الأرصدة المستحقة'],
    priority: 86,
    workspace: 'billing',
  },
  {
    id: 'dashboard.snapshot',
    phrasesEn: [
      'dashboard kpi',
      'dashboard overview',
      'explain dashboard',
      'explain kpis',
      'today activity',
      'operational kpis',
      'summarize today operational kpis',
    ],
    phrasesAr: ['لوحة التحكم', 'مؤشرات اللوحة', 'اشرح لوحة التحكم', 'مؤشرات الأداء'],
    priority: 85,
    workspace: 'management',
  },
  {
    id: 'ai.usage',
    phrasesEn: [
      'ai usage',
      'token usage',
      'usage summary',
      'active users',
      'ai consumption',
    ],
    phrasesAr: ['استخدام الذكاء', 'استهلاك الرموز', 'ملخص الاستخدام', 'مستخدمون نشطون'],
    priority: 84,
    workspace: 'admin',
  },
  {
    id: 'app.help',
    phrasesEn: [
      'help',
      'what can you do',
      'how can you help',
      'how do i use',
      'assistant help',
      'what can the assistant do',
    ],
    phrasesAr: ['مساعدة', 'ماذا يمكنك', 'كيف تساعدني', 'كيف أستخدم', 'ماذا يفعل المساعد'],
    priority: 60,
  },
];

export const AI_SKILL_ROUTE_MIN_SCORE = 52;

const SKILL_IDS = new Set<string>(AI_SKILL_REGISTRY.map((s) => s.id));

export function isAiSkillId(value: string): value is AiSkillId {
  return SKILL_IDS.has(value);
}

export function getSkillDef(skillId: AiSkillId): AiSkillDef | undefined {
  return AI_SKILL_REGISTRY.find((s) => s.id === skillId);
}

export function skillPrimaryPhrase(skillId: AiSkillId, useAr: boolean): string {
  const def = getSkillDef(skillId);
  if (!def) return skillId;
  const phrases = useAr ? def.phrasesAr : def.phrasesEn;
  return phrases[0] ?? skillId;
}

export function isSkillWorkspaceAllowed(
  def: AiSkillDef,
  allowedWorkspaces: AiPlanLimits['workspaces'],
): boolean {
  if (!def.workspace) return true;
  if (allowedWorkspaces === 'all') return true;
  return allowedWorkspaces.includes(def.workspace);
}

export function scoreSkillDef(
  query: string,
  def: AiSkillDef,
  useAr: boolean,
  ctx: AiSmartActionContext,
): number {
  if (!contextSatisfied(ctx, def.requiresContext)) return 0;

  const phrases = useAr ? def.phrasesAr : def.phrasesEn;
  let best = 0;
  for (const phrase of phrases) {
    best = Math.max(best, scoreCommandPhrase(query, phrase));
  }
  if (best === 0) return 0;
  return best + def.priority / 100;
}

export function resolveSkillRoute(
  query: string,
  ctx: AiSmartActionContext,
  locale?: string,
  allowedWorkspaces: AiPlanLimits['workspaces'] = 'all',
  forcedSkillId?: string | null,
): { skillId: AiSkillId; score: number } | null {
  if (forcedSkillId && isAiSkillId(forcedSkillId)) {
    const def = getSkillDef(forcedSkillId);
    if (def && isSkillWorkspaceAllowed(def, allowedWorkspaces) && contextSatisfied(ctx, def.requiresContext)) {
      return { skillId: forcedSkillId, score: 100 };
    }
    return null;
  }

  const useAr = Boolean(locale?.startsWith('ar'));
  let best: { skillId: AiSkillId; score: number } | null = null;

  for (const def of AI_SKILL_REGISTRY) {
    if (!isSkillWorkspaceAllowed(def, allowedWorkspaces)) continue;
    const score = scoreSkillDef(query, def, useAr, ctx);
    if (score < AI_SKILL_ROUTE_MIN_SCORE) continue;
    if (!best || score > best.score) {
      best = { skillId: def.id, score };
    }
  }

  return best;
}
