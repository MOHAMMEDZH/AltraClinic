import { useEffect } from 'react';
import { applyLayoutSnapshot, applyThemeSnapshot } from '../lib/white-label-theme-applier';
import type { EffectiveWhiteLabelSnapshot } from '../lib/white-label-types';

interface WhiteLabelThemeSyncProps {
  effective: EffectiveWhiteLabelSnapshot;
}

export function WhiteLabelThemeSync({ effective }: WhiteLabelThemeSyncProps) {
  useEffect(() => {
    applyThemeSnapshot(effective.theme);
    applyLayoutSnapshot(effective.layout);
  }, [effective.theme, effective.layout]);

  return null;
}
