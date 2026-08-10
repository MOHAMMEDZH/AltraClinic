import { useI18n } from '@booking/i18n/react';
import { VisuallyHidden } from './VisuallyHidden';

interface SpinnerProps {
  label?: string;
  size?: 'sm' | 'md';
  /**
   * When true, the spinner is purely decorative (`aria-hidden`) and does not
   * announce its own status. Use this when it sits inside a control that
   * already communicates its busy state another way (e.g. a `Button` with
   * `aria-busy` and unchanged visible text) — otherwise the spinner's label
   * gets folded into that control's accessible name.
   */
  decorative?: boolean;
}

/** Indeterminate progress indicator. Respects prefers-reduced-motion via CSS. */
export function Spinner({ label, size = 'md', decorative = false }: SpinnerProps) {
  const { t } = useI18n();

  if (decorative) {
    return <span aria-hidden="true" className={`sa-spinner sa-spinner-${size}`} />;
  }

  const accessibleLabel = label ?? t('common.states.loading', 'Loading…');
  return (
    <span className={`sa-spinner sa-spinner-${size}`} role="status" aria-live="polite">
      <VisuallyHidden>{accessibleLabel}</VisuallyHidden>
    </span>
  );
}
