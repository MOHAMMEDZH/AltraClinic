import { useEffect } from 'react';
import type { BeautyWorkspaceTab } from '../types/beauty.types';

interface UseBeautyKeyboardShortcutsOptions {
  enabled?: boolean;
  onSave?: () => void;
  onTab?: (tab: BeautyWorkspaceTab) => void;
  onFocusSearch?: () => void;
}

const TAB_KEYS: Record<string, BeautyWorkspaceTab> = {
  '1': 'overview',
  '2': 'consultation',
  '3': 'face',
  '4': 'body',
  '5': 'plans',
  '6': 'sessions',
  '7': 'skincare',
  '8': 'materials',
  '9': 'gallery',
  '0': 'measurements',
};

export function useBeautyKeyboardShortcuts({
  enabled = true,
  onSave,
  onTab,
  onFocusSearch,
}: UseBeautyKeyboardShortcutsOptions): void {
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
