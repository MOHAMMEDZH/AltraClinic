import { useCallback, useEffect, useState } from 'react';
import {
  ANALYTICS_FAVORITES_KEY,
  ANALYTICS_RECENTS_KEY,
  MAX_ANALYTICS_RECENTS,
} from '../config/analytics-config';

function readIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: string[]) {
  localStorage.setItem(key, JSON.stringify(ids));
}

export function useAnalyticsFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => readIds(ANALYTICS_FAVORITES_KEY));

  useEffect(() => {
    writeIds(ANALYTICS_FAVORITES_KEY, favorites);
  }, [favorites]);

  const toggleFavorite = useCallback((domainId: string) => {
    setFavorites((prev) =>
      prev.includes(domainId) ? prev.filter((id) => id !== domainId) : [...prev, domainId],
    );
  }, []);

  const isFavorite = useCallback((domainId: string) => favorites.includes(domainId), [favorites]);

  return { favorites, toggleFavorite, isFavorite };
}

export function useAnalyticsRecents() {
  const [recents, setRecents] = useState<string[]>(() => readIds(ANALYTICS_RECENTS_KEY));

  useEffect(() => {
    writeIds(ANALYTICS_RECENTS_KEY, recents);
  }, [recents]);

  const trackRecent = useCallback((domainId: string) => {
    setRecents((prev) =>
      [domainId, ...prev.filter((id) => id !== domainId)].slice(0, MAX_ANALYTICS_RECENTS),
    );
  }, []);

  return { recents, trackRecent };
}
