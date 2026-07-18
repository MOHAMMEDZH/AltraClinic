import type { TreatmentItemStatus, TreatmentPlanStatus } from './treatment-plan.types';

export const PROCEDURE_CATALOG = [
  { code: 'D0120', description: 'Periodic oral evaluation', minutes: 20, cost: 65 },
  { code: 'D0140', description: 'Limited oral evaluation', minutes: 20, cost: 85 },
  { code: 'D0150', description: 'Comprehensive oral evaluation', minutes: 45, cost: 120 },
  { code: 'D2391', description: 'Composite filling — one surface', minutes: 45, cost: 220 },
  { code: 'D2392', description: 'Composite filling — two surfaces', minutes: 55, cost: 280 },
  { code: 'D2740', description: 'Crown — porcelain/ceramic', minutes: 75, cost: 1450 },
  { code: 'D3310', description: 'Root canal — anterior', minutes: 90, cost: 950 },
  { code: 'D3320', description: 'Root canal — bicuspid', minutes: 100, cost: 1050 },
  { code: 'D3330', description: 'Root canal — molar', minutes: 120, cost: 1200 },
  { code: 'D6010', description: 'Surgical placement of implant', minutes: 90, cost: 2100 },
  { code: 'D7140', description: 'Extraction — erupted tooth', minutes: 40, cost: 195 },
  { code: 'D7210', description: 'Extraction — surgical', minutes: 60, cost: 350 },
  { code: 'D4341', description: 'Scaling & root planing — per quadrant', minutes: 60, cost: 275 },
  { code: 'D4910', description: 'Periodontal maintenance', minutes: 45, cost: 165 },
] as const;

export const PLAN_STATUS_OPTIONS: { value: TreatmentPlanStatus; labelKey: string; tone: string }[] = [
  { value: 'draft', labelKey: 'dental.treatmentPlan.status.draft', tone: 'muted' },
  { value: 'pending_approval', labelKey: 'dental.treatmentPlan.status.pendingApproval', tone: 'warning' },
  { value: 'approved', labelKey: 'dental.treatmentPlan.status.approved', tone: 'info' },
  { value: 'in_progress', labelKey: 'dental.treatmentPlan.status.inProgress', tone: 'accent' },
  { value: 'completed', labelKey: 'dental.treatmentPlan.status.completed', tone: 'success' },
  { value: 'cancelled', labelKey: 'dental.treatmentPlan.status.cancelled', tone: 'danger' },
];

export const ITEM_STATUS_OPTIONS: { value: TreatmentItemStatus; labelKey: string }[] = [
  { value: 'planned', labelKey: 'dental.treatmentPlan.itemStatus.planned' },
  { value: 'scheduled', labelKey: 'dental.treatmentPlan.itemStatus.scheduled' },
  { value: 'in_progress', labelKey: 'dental.treatmentPlan.itemStatus.inProgress' },
  { value: 'completed', labelKey: 'dental.treatmentPlan.itemStatus.completed' },
  { value: 'blocked', labelKey: 'dental.treatmentPlan.itemStatus.blocked' },
  { value: 'cancelled', labelKey: 'dental.treatmentPlan.itemStatus.cancelled' },
];

export function canApproveDental(perm: (action: string) => boolean): boolean {
  return perm('approve');
}

export function formatCurrency(amount: number, locale: string, currency = 'USD'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

export function formatDuration(minutes: number, _locale: string): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatPlanDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
}

export function statusTone(status: TreatmentPlanStatus): string {
  return PLAN_STATUS_OPTIONS.find((o) => o.value === status)?.tone ?? 'muted';
}

export function calcInsuranceDefaults(cost: number, coveragePercent = 80) {
  const insuranceEstimate = Math.round(cost * (coveragePercent / 100));
  return { insuranceEstimate, patientPortion: cost - insuranceEstimate };
}

export function newLocalItem(
  code: string,
  description: string,
  toothNumbers: number[] = [],
): Omit<import('./treatment-plan.types').TreatmentPlanItem, 'id' | 'phaseId'> & { id: string } {
  const catalog = PROCEDURE_CATALOG.find((p) => p.code === code);
  const cost = catalog?.cost ?? 200;
  const { insuranceEstimate, patientPortion } = calcInsuranceDefaults(cost);
  return {
    id: `local-${crypto.randomUUID()}`,
    sortOrder: 0,
    code,
    description: description || catalog?.description || code,
    toothNumbers,
    status: 'planned',
    estimatedMinutes: catalog?.minutes ?? 30,
    estimatedCost: cost,
    dependsOnItemId: null,
    completedAt: null,
    insuranceEligible: true,
    insuranceEstimate,
    patientPortion,
    requiresPreAuth: cost > 1000,
    preAuthStatus: null,
  };
}

export function resolvePlanViewMode(roles: string[]): import('./treatment-plan.types').TreatmentPlanViewMode {
  if (roles.some((r) => ['owner', 'general_manager', 'super_admin'].includes(r))) return 'management';
  if (roles.some((r) => ['receptionist', 'assistant'].includes(r))) return 'patient';
  return 'doctor';
}
