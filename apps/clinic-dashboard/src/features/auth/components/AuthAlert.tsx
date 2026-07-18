import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './AuthAlert.module.css';

type AlertVariant = 'error' | 'success' | 'info' | 'warning';

interface AuthAlertProps {
  variant: AlertVariant;
  title?: string;
  children: ReactNode;
  id?: string;
}

const icons: Record<AlertVariant, typeof AlertCircle> = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
  warning: TriangleAlert,
};

export function AuthAlert({ variant, title, children, id }: AuthAlertProps) {
  const Icon = icons[variant];
  const role = variant === 'error' || variant === 'warning' ? 'alert' : 'status';

  return (
    <div id={id} className={[styles.alert, styles[variant]].join(' ')} role={role}>
      <Icon className={styles.icon} size={18} aria-hidden />
      <div className={styles.content}>
        {title && <p className={styles.title}>{title}</p>}
        <div className={styles.message}>{children}</div>
      </div>
    </div>
  );
}
