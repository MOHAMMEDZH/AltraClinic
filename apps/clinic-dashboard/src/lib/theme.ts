export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_KEY = 'booking.theme';

export function loadThemeMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'light';
}

export function persistThemeMode(mode: ThemeMode): void {
  localStorage.setItem(THEME_KEY, mode);
}

export function applyThemeMode(mode: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', mode);
}

export function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
