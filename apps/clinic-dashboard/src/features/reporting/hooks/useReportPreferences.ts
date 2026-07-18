import { useCallback, useEffect, useState } from 'react';
import { FAVORITES_STORAGE_KEY, MAX_RECENTS, RECENTS_STORAGE_KEY } from '../config/reporting-config';

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

export function useReportFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => readIds(FAVORITES_STORAGE_KEY));

  useEffect(() => {
    writeIds(FAVORITES_STORAGE_KEY, favorites);
  }, [favorites]);

  const toggleFavorite = useCallback((templateId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(templateId) ? prev.filter((id) => id !== templateId) : [...prev, templateId];
      writeIds(FAVORITES_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const isFavorite = useCallback((templateId: string) => favorites.includes(templateId), [favorites]);

  return { favorites, toggleFavorite, isFavorite };
}

export function useReportRecents() {
  const [recents, setRecents] = useState<string[]>(() => readIds(RECENTS_STORAGE_KEY));

  useEffect(() => {
    writeIds(RECENTS_STORAGE_KEY, recents);
  }, [recents]);

  const trackRecent = useCallback((templateId: string) => {
    setRecents((prev) => {
      const next = [templateId, ...prev.filter((id) => id !== templateId)].slice(0, MAX_RECENTS);
      writeIds(RECENTS_STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { recents, trackRecent };
}
