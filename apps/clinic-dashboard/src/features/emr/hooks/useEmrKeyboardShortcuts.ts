import { useEffect } from 'react';
import type { EmrWorkspaceTab } from '../types/emr.types';

interface UseEmrKeyboardShortcutsOptions {
  enabled?: boolean;
  onSave?: () => void;
  onTab?: (tab: EmrWorkspaceTab) => void;
}

const TAB_KEYS: Record<string, EmrWorkspaceTab> = {
  '1': 'overview',
  '2': 'vitals',
  '3': 'diagnoses',
  '4': 'prescriptions',
  '5': 'notes',
  '6': 'labs',
  '7': 'carePlan',
  '8': 'billing',
};

export function useEmrKeyboardShortcuts({
  enabled = true,
  onSave,
  onTab,
}: UseEmrKeyboardShortcutsOptions): void {
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
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
  }, [enabled, onSave, onTab]);
}
