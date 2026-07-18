import type {
  BeautyConsultation,
  BeautySession,
  BeautyTreatmentPlan,
  PlanSessionStep,
} from '../types/beauty.types';

export function createBeautyId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export const DEFAULT_PROCEDURE_COSTS: Record<string, number> = {
  botox: 350,
  filler: 450,
  laser: 300,
  prp: 400,
  peel: 250,
  microneedling: 280,
  other: 200,
};

export const SKIN_ASSESSMENT_FIELDS = ['hydration', 'elasticity', 'pigmentation', 'texture', 'sensitivity'] as const;
export const FACIAL_ASSESSMENT_FIELDS = ['symmetry', 'volumeLoss', 'dynamicLines', 'staticLines', 'skinQuality'] as const;
export const BODY_ASSESSMENT_FIELDS = ['contour', 'skinLaxity', 'cellulite', 'fatDistribution'] as const;

export function defaultConsultation(clinicianId: string, type: BeautyConsultation['type'] = 'initial'): BeautyConsultation {
  return {
    id: createBeautyId('consult'),
    type,
    status: 'draft',
    date: new Date().toISOString(),
    clinicianId,
    skinAssessment: Object.fromEntries(SKIN_ASSESSMENT_FIELDS.map((f) => [f, ''])),
    facialAssessment: Object.fromEntries(FACIAL_ASSESSMENT_FIELDS.map((f) => [f, ''])),
    bodyAssessment: Object.fromEntries(BODY_ASSESSMENT_FIELDS.map((f) => [f, ''])),
    recommendations: [],
    notes: '',
    consentPhoto: false,
    consentTreatment: false,
  };
}

export function defaultPlanSession(type: string, label?: string): PlanSessionStep {
  return {
    id: createBeautyId('step'),
    type,
    label: label ?? type,
    estimatedCost: DEFAULT_PROCEDURE_COSTS[type] ?? 200,
  };
}

export function defaultTreatmentPlan(): BeautyTreatmentPlan {
  const seq = [defaultPlanSession('consultation', 'Consultation'), defaultPlanSession('botox', 'Botox session 1')];
  return {
    id: createBeautyId('plan'),
    title: '',
    status: 'draft',
    procedures: ['botox'],
    sessionSequence: seq,
    sessionsPlanned: seq.length,
    sessionsCompleted: 0,
    estimatedCost: computePlanCost(seq),
    notes: '',
    invoiceId: null,
    invoiceNumber: null,
  };
}

export function defaultSession(clinicianId: string, plan?: BeautyTreatmentPlan, step?: PlanSessionStep): BeautySession {
  return {
    id: createBeautyId('session'),
    planId: plan?.id,
    planStepId: step?.id,
    type: step?.type ?? 'botox',
    status: 'scheduled',
    scheduledAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    clinicianId,
    outcome: null,
    notes: '',
    products: [],
    comparisonGroupId: null,
    beforeMediaId: null,
    afterMediaId: null,
    followUpAt: null,
    measurementIds: [],
  };
}

export function computePlanCost(sequence: PlanSessionStep[]): number {
  return sequence.reduce((sum, s) => sum + (s.estimatedCost || 0), 0);
}

export function validateConsultation(c: BeautyConsultation): string | null {
  if (!c.notes?.trim() && c.status === 'completed') return 'notesRequired';
  if (c.status === 'completed' && !c.consentTreatment) return 'consentTreatmentRequired';
  return null;
}

export function validatePlan(p: BeautyTreatmentPlan): string | null {
  if (!p.title.trim()) return 'titleRequired';
  if (!p.sessionSequence.length) return 'sessionsRequired';
  return null;
}

export function validateSession(s: BeautySession, completing = false): string | null {
  if (!s.scheduledAt) return 'dateRequired';
  if (completing && !s.outcome?.trim()) return 'outcomeRequired';
  return null;
}

export function reorderSteps(sequence: PlanSessionStep[], fromIndex: number, toIndex: number): PlanSessionStep[] {
  const next = [...sequence];
  const [item] = next.splice(fromIndex, 1);
  if (!item) return sequence;
  next.splice(toIndex, 0, item);
  return next;
}

type LegacyTreatmentPlan = Omit<BeautyTreatmentPlan, 'sessionSequence'> & {
  sessionSequence?: PlanSessionStep[];
};

export function migratePlan(plan: LegacyTreatmentPlan): BeautyTreatmentPlan {
  if (plan.sessionSequence?.length) return plan as BeautyTreatmentPlan;
  const seq = plan.procedures.map((p, i) => defaultPlanSession(p, `Session ${i + 1}`));
  return {
    ...plan,
    sessionSequence: seq,
    sessionsPlanned: seq.length,
    estimatedCost: computePlanCost(seq),
    invoiceId: plan.invoiceId ?? null,
    invoiceNumber: plan.invoiceNumber ?? null,
  };
}

export function migrateConsultation(c: BeautyConsultation): BeautyConsultation {
  const rawType = c.type as string;
  return {
    ...c,
    type: (rawType === 'followUp' || rawType === 'follow_up' ? 'follow_up' : 'initial') as BeautyConsultation['type'],
    status: c.status ?? 'completed',
    consentTreatment: c.consentTreatment ?? false,
  };
}

/** Maps face-map click coordinates (0–100%) to an anatomical zone. */
export function detectFaceZone(x: number, y: number): string {
  if (y < 32) return 'forehead';
  if (y < 42 && x >= 38 && x <= 62) return 'glabella';
  if (y < 50 && x < 36) return 'crow_feet_left';
  if (y < 50 && x > 64) return 'crow_feet_right';
  if (y >= 58 && y < 72 && x >= 35 && x <= 65) return 'lips';
  if (y >= 72 && y < 82) return 'chin';
  if (y >= 78 || (y >= 65 && (x < 28 || x > 72))) return 'jawline';
  if (x < 42 && y >= 45) return 'cheek_left';
  if (x > 58 && y >= 45) return 'cheek_right';
  if (x < 52 && y >= 52 && y < 68) return 'nasolabial_left';
  if (x >= 48 && y >= 52 && y < 68) return 'nasolabial_right';
  return 'forehead';
}
