import type { CanonicalThemeToken, ThemeTokenGroupId } from './white-label-types';

export const CANONICAL_THEME_TOKEN_GROUP_IDS: readonly ThemeTokenGroupId[] = [
  'color-primary',
  'color-accent',
  'color-semantic',
  'color-surface',
  'typography',
  'spacing',
  'radius',
  'shadow',
  'chart',
  'status',
] as const;

export const CANONICAL_THEME_TOKENS: readonly CanonicalThemeToken[] = [
  { tokenId: 'color-primary-500', cssVar: '--color-primary-500', tokenGroupId: 'color-primary', tier: 'tenantOverride', marketplaceAllowlist: false, labelKey: 'whitelabel.tokens.primary500' },
  { tokenId: 'color-primary', cssVar: '--color-primary', tokenGroupId: 'color-primary', tier: 'tenantOverride', marketplaceAllowlist: false, labelKey: 'whitelabel.tokens.primary' },
  { tokenId: 'color-accent-500', cssVar: '--color-secondary-500', tokenGroupId: 'color-accent', tier: 'tenantOverride', marketplaceAllowlist: false, labelKey: 'whitelabel.tokens.accent500' },
  { tokenId: 'color-success', cssVar: '--color-success', tokenGroupId: 'color-semantic', tier: 'platformLocked', marketplaceAllowlist: false, labelKey: 'whitelabel.tokens.success' },
  { tokenId: 'color-warning', cssVar: '--color-warning', tokenGroupId: 'color-semantic', tier: 'platformLocked', marketplaceAllowlist: false, labelKey: 'whitelabel.tokens.warning' },
  { tokenId: 'color-error', cssVar: '--color-error', tokenGroupId: 'color-semantic', tier: 'platformLocked', marketplaceAllowlist: false, labelKey: 'whitelabel.tokens.error' },
  { tokenId: 'color-info', cssVar: '--color-info', tokenGroupId: 'color-semantic', tier: 'platformLocked', marketplaceAllowlist: false, labelKey: 'whitelabel.tokens.info' },
  { tokenId: 'color-bg', cssVar: '--color-bg', tokenGroupId: 'color-surface', tier: 'tenantOverride', marketplaceAllowlist: true, labelKey: 'whitelabel.tokens.bg' },
  { tokenId: 'color-surface', cssVar: '--color-surface', tokenGroupId: 'color-surface', tier: 'tenantOverride', marketplaceAllowlist: true, labelKey: 'whitelabel.tokens.surface' },
  { tokenId: 'color-border', cssVar: '--color-border', tokenGroupId: 'color-surface', tier: 'tenantOverride', marketplaceAllowlist: true, labelKey: 'whitelabel.tokens.border' },
  { tokenId: 'color-text-primary', cssVar: '--color-text-primary', tokenGroupId: 'color-surface', tier: 'tenantOverride', marketplaceAllowlist: true, labelKey: 'whitelabel.tokens.textPrimary' },
  { tokenId: 'color-focus-ring', cssVar: '--color-focus-ring', tokenGroupId: 'color-semantic', tier: 'platformLocked', marketplaceAllowlist: false, labelKey: 'whitelabel.tokens.focusRing' },
  { tokenId: 'font-latin', cssVar: '--font-latin', tokenGroupId: 'typography', tier: 'marketplaceTheme', marketplaceAllowlist: true, labelKey: 'whitelabel.tokens.fontLatin' },
  { tokenId: 'font-arabic', cssVar: '--font-arabic', tokenGroupId: 'typography', tier: 'marketplaceTheme', marketplaceAllowlist: true, labelKey: 'whitelabel.tokens.fontArabic' },
  { tokenId: 'text-body', cssVar: '--text-body', tokenGroupId: 'typography', tier: 'platformLocked', marketplaceAllowlist: false, labelKey: 'whitelabel.tokens.textBody' },
  { tokenId: 'space-4', cssVar: '--space-4', tokenGroupId: 'spacing', tier: 'platformLocked', marketplaceAllowlist: false, labelKey: 'whitelabel.tokens.space4' },
  { tokenId: 'space-6', cssVar: '--space-6', tokenGroupId: 'spacing', tier: 'marketplaceTheme', marketplaceAllowlist: true, labelKey: 'whitelabel.tokens.space6' },
  { tokenId: 'radius-md', cssVar: '--radius-md', tokenGroupId: 'radius', tier: 'marketplaceTheme', marketplaceAllowlist: true, labelKey: 'whitelabel.tokens.radiusMd' },
  { tokenId: 'radius-lg', cssVar: '--radius-lg', tokenGroupId: 'radius', tier: 'marketplaceTheme', marketplaceAllowlist: true, labelKey: 'whitelabel.tokens.radiusLg' },
  { tokenId: 'shadow-2', cssVar: '--shadow-2', tokenGroupId: 'shadow', tier: 'marketplaceTheme', marketplaceAllowlist: true, labelKey: 'whitelabel.tokens.shadow2' },
  { tokenId: 'chart-series-1', cssVar: '--chart-series-1', tokenGroupId: 'chart', tier: 'marketplaceTheme', marketplaceAllowlist: true, labelKey: 'whitelabel.tokens.chartSeries1' },
  { tokenId: 'chart-grid', cssVar: '--chart-grid', tokenGroupId: 'chart', tier: 'marketplaceTheme', marketplaceAllowlist: true, labelKey: 'whitelabel.tokens.chartGrid' },
  { tokenId: 'status-queue-waiting', cssVar: '--status-queue-waiting', tokenGroupId: 'status', tier: 'platformLocked', marketplaceAllowlist: false, labelKey: 'whitelabel.tokens.statusQueueWaiting' },
  { tokenId: 'theme-mode', cssVar: 'data-theme', tokenGroupId: 'color-surface', tier: 'runtimePreference', marketplaceAllowlist: false, labelKey: 'whitelabel.tokens.themeMode' },
  { tokenId: 'z-modal', cssVar: '--z-modal', tokenGroupId: 'spacing', tier: 'platformLocked', marketplaceAllowlist: false, labelKey: 'whitelabel.tokens.zModal' },
  { tokenId: 'sidebar-width', cssVar: '--sidebar-width', tokenGroupId: 'spacing', tier: 'platformLocked', marketplaceAllowlist: false, labelKey: 'whitelabel.tokens.sidebarWidth' },
  { tokenId: 'header-height', cssVar: '--header-height', tokenGroupId: 'spacing', tier: 'platformLocked', marketplaceAllowlist: false, labelKey: 'whitelabel.tokens.headerHeight' },
] as const;

export const CANONICAL_THEME_TOKEN_COUNT = CANONICAL_THEME_TOKENS.length;

export const CANONICAL_THEME_TOKEN_IDS = CANONICAL_THEME_TOKENS.map((token) => token.tokenId);

export const CANONICAL_THEME_TOKEN_ID_SET = new Set(CANONICAL_THEME_TOKEN_IDS);
