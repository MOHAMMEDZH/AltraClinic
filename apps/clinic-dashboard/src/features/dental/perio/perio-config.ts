import { LOWER_TEETH, UPPER_TEETH, toothFdiLabel } from '../config/dental-config';
import type { PerioSiteId, PerioStage, PerioSummary, PerioToothRecord } from './perio.types';
import { PERIO_SITES } from './perio.types';

export { PERIO_SITES, UPPER_TEETH, LOWER_TEETH, toothFdiLabel };

export const MOLAR_TEETH = new Set([1, 2, 3, 14, 15, 16, 17, 18, 19, 30, 31, 32]);

export const SITE_LABEL_KEYS: Record<PerioSiteId, string> = {
  mb: 'dental.perio.sites.mb',
  b: 'dental.perio.sites.b',
  db: 'dental.perio.sites.db',
  ml: 'dental.perio.sites.ml',
  l: 'dental.perio.sites.l',
  dl: 'dental.perio.sites.dl',
};

export const MOBILITY_OPTIONS = [0, 1, 2, 3] as const;
export const FURCATION_OPTIONS = [0, 1, 2, 3] as const;
export const PLAQUE_OPTIONS = [0, 1, 2, 3] as const;

export type PdSeverity = 'healthy' | 'watch' | 'moderate' | 'severe' | 'critical';

export function pdSeverity(pd: number): PdSeverity {
  if (pd <= 3) return 'healthy';
  if (pd === 4) return 'watch';
  if (pd <= 5) return 'moderate';
  if (pd === 6) return 'severe';
  return 'critical';
}

export function pdSeverityClass(severity: PdSeverity): string {
  return `pd_${severity}`;
}

export function stageTone(stage: PerioStage): 'success' | 'info' | 'warning' | 'danger' {
  switch (stage) {
    case 'healthy':
      return 'success';
    case 'gingivitis':
    case 'mild':
      return 'info';
    case 'moderate':
      return 'warning';
    case 'severe':
      return 'danger';
  }
}

export function emptySite() {
  return { pd: 0, recession: 0, bop: false };
}

export function defaultTooth(toothNumber: number): PerioToothRecord {
  const sites = Object.fromEntries(PERIO_SITES.map((id) => [id, emptySite()])) as PerioToothRecord['sites'];
  return { toothNumber, mobility: 0, furcation: null, plaqueIndex: 0, sites };
}

export function buildDefaultTeeth(): PerioToothRecord[] {
  return Array.from({ length: 32 }, (_, i) => defaultTooth(i + 1));
}

export function maxPocketDepth(tooth: PerioToothRecord): number {
  if (tooth.missing) return 0;
  return Math.max(...PERIO_SITES.map((id) => tooth.sites[id]?.pd ?? 0));
}

export function bopSiteCount(tooth: PerioToothRecord): number {
  return PERIO_SITES.filter((id) => tooth.sites[id]?.bop).length;
}

export function toothSeverity(tooth: PerioToothRecord): PdSeverity {
  return pdSeverity(maxPocketDepth(tooth));
}

export function formatPerioDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function suggestPerioProcedures(summary: PerioSummary): { code: string; labelKey: string }[] {
  const suggestions: { code: string; labelKey: string }[] = [];
  if (summary.stage === 'moderate' || summary.stage === 'severe' || summary.sitesPd5Plus >= 4) {
    suggestions.push({ code: 'D4341', labelKey: 'dental.perio.suggest.srp' });
  }
  if (summary.stage !== 'healthy' && summary.stage !== 'gingivitis') {
    suggestions.push({ code: 'D4910', labelKey: 'dental.perio.suggest.maintenance' });
  }
  return suggestions;
}

export function cloneTeeth(teeth: PerioToothRecord[]): PerioToothRecord[] {
  return teeth.map((t) => ({
    ...t,
    sites: Object.fromEntries(
      PERIO_SITES.map((id) => [id, { ...t.sites[id] }]),
    ) as PerioToothRecord['sites'],
  }));
}
