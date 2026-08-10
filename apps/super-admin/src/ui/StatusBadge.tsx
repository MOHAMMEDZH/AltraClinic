import { Badge, type BadgeVariant } from './Badge';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusBadgeProps {
  /** Human-readable status text — always rendered, never color-only. */
  label: string;
  tone?: StatusTone;
}

const TONE_TO_VARIANT: Record<StatusTone, BadgeVariant> = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  neutral: 'neutral',
};

/** Status indicator with mandatory text label (accessible without relying on color). */
export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return <Badge variant={TONE_TO_VARIANT[tone]}>{label}</Badge>;
}
