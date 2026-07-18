const RECENT_KEY = 'settings.nav.recent';
const FAVORITES_KEY = 'settings.nav.favorites';
const MAX_RECENT = 8;

export function recordSettingsVisit(path: string) {
  if (typeof window === 'undefined' || !path.startsWith('/settings')) return;
  try {
    const recent = loadRecent().filter((p) => p !== path);
    recent.unshift(path);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {
    /* ignore storage errors */
  }
}

export function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(path: string): string[] {
  const favorites = loadFavorites();
  const next = favorites.includes(path) ? favorites.filter((p) => p !== path) : [...favorites, path];
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  return next;
}

export function isFavorite(path: string): boolean {
  return loadFavorites().includes(path);
}
