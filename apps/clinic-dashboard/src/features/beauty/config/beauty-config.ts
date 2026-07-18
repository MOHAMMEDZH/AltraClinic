import type { BeautyBodyMapState, BeautyViewMode } from '../types/beauty.types';

type PermFn = (action: string) => boolean;

export function canViewBeauty(perm: PermFn): boolean {
  return perm('view');
}

export function canCreateBeauty(perm: PermFn): boolean {
  return perm('create');
}

export function canUpdateBeauty(perm: PermFn): boolean {
  return perm('update');
}

export function resolveBeautyViewMode(roles: string[]): BeautyViewMode {
  if (roles.some((r) => ['owner', 'general_manager', 'super_admin'].includes(r))) return 'manager';
  if (roles.includes('receptionist')) return 'reception';
  return 'practitioner';
}

export function formatBeautyDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatBeautyDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCurrency(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    amount,
  );
}

export const SKIN_TYPES = ['normal', 'dry', 'oily', 'combination', 'sensitive'] as const;
export const SKIN_CONCERNS = [
  'fine_lines',
  'wrinkles',
  'volume_loss',
  'pigmentation',
  'acne',
  'scarring',
  'redness',
  'texture',
] as const;
export const TREATMENT_TYPES = ['botox', 'filler', 'laser', 'prp', 'peel', 'microneedling', 'other'] as const;
export const FACE_ZONES = [
  'forehead',
  'glabella',
  'crow_feet_left',
  'crow_feet_right',
  'cheek_left',
  'cheek_right',
  'nasolabial_left',
  'nasolabial_right',
  'lips',
  'chin',
  'jawline',
] as const;
export const BODY_ZONES = [
  'abdomen',
  'flanks_left',
  'flanks_right',
  'thighs',
  'arms',
  'back',
  'buttocks',
  'neck',
] as const;

export function emptyBodyMapState(): BeautyBodyMapState {
  return {
    version: 1,
    profile: { skinType: null, concerns: [], allergies: [], notes: '' },
    consultations: [],
    treatmentPlans: [],
    sessions: [],
    measurements: [],
    consents: [],
    skincareRegimens: [],
  };
}

export function normalizeBodyMapState(raw: unknown): BeautyBodyMapState {
  const base = emptyBodyMapState();
  if (!raw || typeof raw !== 'object') return base;
  const s = raw as Partial<BeautyBodyMapState>;
  return {
    version: s.version ?? 1,
    profile: { ...base.profile, ...(s.profile ?? {}) },
    consultations: s.consultations ?? [],
    treatmentPlans: s.treatmentPlans ?? [],
    sessions: s.sessions ?? [],
    measurements: s.measurements ?? [],
    consents: s.consents ?? [],
    skincareRegimens: s.skincareRegimens ?? [],
  };
}

export function countUpcomingSessions(state: BeautyBodyMapState): number {
  const now = Date.now();
  return state.sessions.filter((s) => s.status === 'scheduled' && new Date(s.scheduledAt).getTime() >= now).length;
}

export function countActivePlans(state: BeautyBodyMapState): number {
  return state.treatmentPlans.filter((p) => p.status === 'active' || p.status === 'approved').length;
}

type TranslateFn = (key: string) => string;

/** Resolves a treatment type to a localized label, falling back to the raw type. */
export function treatmentLabel(t: TranslateFn, type: string): string {
  const key = `beauty.treatments.${type}`;
  const label = t(key);
  return label === key ? type : label;
}

const INVOICE_STATUS_KEYS: Record<string, string> = {
  DRAFT: 'draft',
  SENT: 'sent',
  PAID: 'paid',
  PARTIALLY_PAID: 'partial',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
  VOID: 'void',
};

export function invoiceStatusLabel(t: TranslateFn, status: string): string {
  const normalized = status.toUpperCase().replace(/-/g, '_');
  const slug = INVOICE_STATUS_KEYS[normalized] ?? status.toLowerCase();
  const key = `beauty.billing.invoiceStatus.${slug}`;
  const label = t(key);
  return label === key ? status : label;
}

