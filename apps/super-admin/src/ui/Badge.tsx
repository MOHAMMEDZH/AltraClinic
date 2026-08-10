import type { ReactNode } from 'react';

export type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
}

/** Small pill for labels/counts. Never conveys meaning through color alone — always pair with text. */
export function Badge({ children, variant = 'neutral' }: BadgeProps) {
  return <span className={`sa-badge sa-badge-${variant}`}>{children}</span>;
}
