import type { CanonicalLayoutProfile } from './white-label-types';

export const CANONICAL_LAYOUT_PROFILES: readonly CanonicalLayoutProfile[] = [
  {
    layoutId: 'clinical-default',
    labelKey: 'whitelabel.layout.clinicalDefault',
    descriptionKey: 'whitelabel.layout.clinicalDefaultDesc',
    navigationStyle: 'sidebar',
    sidebarWidthExpanded: 260,
    sidebarWidthCollapsed: 72,
    menuDensity: 'comfortable',
    sortOrder: 10,
  },
  {
    layoutId: 'clinical-compact',
    labelKey: 'whitelabel.layout.clinicalCompact',
    descriptionKey: 'whitelabel.layout.clinicalCompactDesc',
    navigationStyle: 'sidebar',
    sidebarWidthExpanded: 260,
    sidebarWidthCollapsed: 72,
    menuDensity: 'compact',
    sortOrder: 20,
  },
  {
    layoutId: 'enterprise-topnav',
    labelKey: 'whitelabel.layout.enterpriseTopnav',
    descriptionKey: 'whitelabel.layout.enterpriseTopnavDesc',
    navigationStyle: 'topnav',
    sidebarWidthExpanded: null,
    sidebarWidthCollapsed: null,
    menuDensity: 'comfortable',
    sortOrder: 30,
  },
  {
    layoutId: 'minimal-login',
    labelKey: 'whitelabel.layout.minimalLogin',
    descriptionKey: 'whitelabel.layout.minimalLoginDesc',
    navigationStyle: 'none',
    sidebarWidthExpanded: null,
    sidebarWidthCollapsed: null,
    menuDensity: 'comfortable',
    sortOrder: 40,
  },
] as const;

export const CANONICAL_LAYOUT_PROFILE_COUNT = CANONICAL_LAYOUT_PROFILES.length;

export const CANONICAL_LAYOUT_PROFILE_IDS = CANONICAL_LAYOUT_PROFILES.map((profile) => profile.layoutId);

export const CANONICAL_LAYOUT_PROFILE_ID_SET = new Set(CANONICAL_LAYOUT_PROFILE_IDS);
