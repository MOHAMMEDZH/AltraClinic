import type { DentalViewMode, OdontogramMode, ToothStatus } from '../types/dental.types';

export const DENTAL_PAGE_SIZE = 20;

/** Universal numbering 1–32 → FDI notation */
export const UNIVERSAL_TO_FDI: Record<number, string> = {
  1: '18', 2: '17', 3: '16', 4: '15', 5: '14', 6: '13', 7: '12', 8: '11',
  9: '21', 10: '22', 11: '23', 12: '24', 13: '25', 14: '26', 15: '27', 16: '28',
  17: '38', 18: '37', 19: '36', 20: '35', 21: '34', 22: '33', 23: '32', 24: '31',
  25: '41', 26: '42', 27: '43', 28: '44', 29: '45', 30: '46', 31: '47', 32: '48',
};

/** Lower arch left-to-right, then lower arch */
export const UPPER_TEETH = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
export const LOWER_TEETH = [32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17];

/** Primary dentition — 20 teeth labeled A–T (Universal primary numbering 1–20) */
export const PEDIATRIC_UPPER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const PEDIATRIC_LOWER = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11];

export const TOOTH_SURFACES: { value: import('../types/dental.types').ToothSurface; labelKey: string }[] = [
  { value: 'mesial', labelKey: 'dental.surfaces.mesial' },
  { value: 'distal', labelKey: 'dental.surfaces.distal' },
  { value: 'occlusal', labelKey: 'dental.surfaces.occlusal' },
  { value: 'buccal', labelKey: 'dental.surfaces.buccal' },
  { value: 'lingual', labelKey: 'dental.surfaces.lingual' },
  { value: 'incisal', labelKey: 'dental.surfaces.incisal' },
];

export const SURFACE_CONDITIONS = [
  { value: 'caries', labelKey: 'dental.surfaces.caries' },
  { value: 'filled', labelKey: 'dental.surfaces.filled' },
  { value: 'watch', labelKey: 'dental.surfaces.watch' },
  { value: 'none', labelKey: 'dental.surfaces.none' },
] as const;

export const TOOTH_STATUS_OPTIONS: { value: ToothStatus; labelKey: string; cssClass: string }[] = [
  { value: 'healthy', labelKey: 'dental.status.healthy', cssClass: 'healthy' },
  { value: 'decayed', labelKey: 'dental.status.decayed', cssClass: 'decayed' },
  { value: 'filled', labelKey: 'dental.status.filled', cssClass: 'filled' },
  { value: 'crown', labelKey: 'dental.status.crown', cssClass: 'crown' },
  { value: 'missing', labelKey: 'dental.status.missing', cssClass: 'missing' },
  { value: 'implant', labelKey: 'dental.status.implant', cssClass: 'implant' },
  { value: 'root_canal', labelKey: 'dental.status.rootCanal', cssClass: 'rootCanal' },
  { value: 'bridge', labelKey: 'dental.status.bridge', cssClass: 'bridge' },
  { value: 'extraction', labelKey: 'dental.status.extraction', cssClass: 'extraction' },
  { value: 'planned', labelKey: 'dental.status.planned', cssClass: 'planned' },
];

export const FAVORITE_PROCEDURES = [
  { code: 'D0120', description: 'Periodic oral evaluation', toothNumbers: [] as number[] },
  { code: 'D2391', description: 'Composite filling — one surface', toothNumbers: [] as number[] },
  { code: 'D2740', description: 'Crown — porcelain/ceramic', toothNumbers: [] as number[] },
  { code: 'D7140', description: 'Extraction — erupted tooth', toothNumbers: [] as number[] },
  { code: 'D6010', description: 'Surgical placement of implant', toothNumbers: [] as number[] },
  { code: 'D3310', description: 'Root canal — anterior', toothNumbers: [] as number[] },
];

export function canViewDental(perm: (action: string) => boolean): boolean {
  return perm('view');
}

export function canCreateDental(perm: (action: string) => boolean): boolean {
  return perm('create');
}

export function canUpdateDental(perm: (action: string) => boolean): boolean {
  return perm('update');
}

export function resolveDentalViewMode(roles: string[]): DentalViewMode {
  if (roles.some((r) => ['owner', 'general_manager', 'super_admin'].includes(r))) return 'manager';
  if (roles.some((r) => ['receptionist', 'assistant'].includes(r))) return 'reception';
  return 'dentist';
}

export function toothFdiLabel(num: number): string {
  return UNIVERSAL_TO_FDI[num] ?? String(num);
}

export function pediatricLetter(num: number): string {
  if (num < 1 || num > 20) return String(num);
  return String.fromCharCode(64 + num);
}

export function inferPediatricMode(dateOfBirth: string | null | undefined): OdontogramMode {
  if (!dateOfBirth) return 'adult';
  const age = (Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000);
  return age < 12 ? 'pediatric' : 'adult';
}

export function statusCssClass(status: ToothStatus): string {
  return TOOTH_STATUS_OPTIONS.find((o) => o.value === status)?.cssClass ?? 'healthy';
}

export function formatDentalDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

export function countByStatus(teeth: { status: ToothStatus }[]): Record<ToothStatus, number> {
  const counts = Object.fromEntries(TOOTH_STATUS_OPTIONS.map((o) => [o.value, 0])) as Record<ToothStatus, number>;
  for (const t of teeth) counts[t.status] = (counts[t.status] ?? 0) + 1;
  return counts;
}
