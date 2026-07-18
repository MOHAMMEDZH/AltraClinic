import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './AuthButton.module.css';

interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  loadingLabel?: string;
  fullWidth?: boolean;
  children: ReactNode;
}

export function AuthButton({
  variant = 'primary',
  loading = false,
  loadingLabel,
  fullWidth = false,
  disabled,
  children,
  ...props
}: AuthButtonProps) {
  return (
    <button
      type="button"
      className={[
        styles.button,
        styles[variant],
        fullWidth ? styles.fullWidth : '',
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className={styles.spinner} aria-hidden />}
      {loading && loadingLabel ? (
        <span className="sr-only">{loadingLabel}</span>
      ) : null}
      {children}
    </button>
  );
}
