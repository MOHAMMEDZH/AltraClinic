import { useEffect } from 'react';
import type { DentalChartTab } from '@/lib/appointment-clinical-nav';

interface UseDentalKeyboardShortcutsOptions {
  enabled?: boolean;
  onSave?: () => void;
  onTab?: (tab: DentalChartTab) => void;
  onFocusSearch?: () => void;
}

const TAB_KEYS: Record<string, DentalChartTab> = {
  '1': 'summary',
  '2': 'procedures',
  '3': 'treatment',
  '4': 'perio',
  '5': 'ortho',
  '6': 'implants',
  '7': 'notes',
  '8': 'timeline',
  '9': 'materials',
  '0': 'imaging',
};

export function useDentalKeyboardShortcuts({
  enabled = true,
  onSave,
  onTab,
  onFocusSearch,
}: UseDentalKeyboardShortcutsOptions): void {
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')) return;
      }

      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onFocusSearch?.();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSave?.();
        return;
      }

      if (e.altKey && TAB_KEYS[e.key]) {
        e.preventDefault();
        onTab?.(TAB_KEYS[e.key]);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, onSave, onTab, onFocusSearch]);
}
