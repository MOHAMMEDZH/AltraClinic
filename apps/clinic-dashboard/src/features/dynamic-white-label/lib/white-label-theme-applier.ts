import { applyThemeMode, type ThemeMode } from '@/lib/theme';
import type { LayoutSnapshot, ThemeSnapshot } from './white-label-types';

const MANAGED_CSS_VARS = new Set([
  '--color-primary',
  '--color-primary-500',
  '--color-secondary-500',
]);

let lastAppliedVars: Record<string, string> = {};

export function applyThemeSnapshot(theme: ThemeSnapshot): void {
  applyThemeMode(theme.mode);

  const root = document.documentElement;

  for (const [key, value] of Object.entries(lastAppliedVars)) {
    if (!(key in theme.cssVariables)) {
      root.style.removeProperty(key);
    }
  }

  for (const [key, value] of Object.entries(theme.cssVariables)) {
    if (!MANAGED_CSS_VARS.has(key)) continue;
    root.style.setProperty(key, value);
  }

  lastAppliedVars = { ...theme.cssVariables };
}

export function applyLayoutSnapshot(layout: LayoutSnapshot): void {
  document.documentElement.style.setProperty('--sidebar-width', layout.sidebarWidth);
  document.documentElement.style.setProperty('--header-height', layout.headerHeight);
}

export function resolveEffectiveThemeMode(
  tenantPreference: ThemeMode | string | undefined,
  userMode: ThemeMode,
): ThemeMode {
  if (userMode === 'light' || userMode === 'dark') {
    return userMode;
  }
  if (tenantPreference === 'light' || tenantPreference === 'dark' || tenantPreference === 'system') {
    return tenantPreference;
  }
  return userMode;
}

export function resetWhiteLabelThemeApplication(): void {
  const root = document.documentElement;
  for (const key of Object.keys(lastAppliedVars)) {
    root.style.removeProperty(key);
  }
  lastAppliedVars = {};
}
