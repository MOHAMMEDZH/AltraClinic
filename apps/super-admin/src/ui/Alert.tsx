import type { ReactNode } from 'react';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
}

/** Inline notice. Danger/warning use `role="alert"`; info/success use `role="status"`. */
export function Alert({ tone = 'info', title, children }: AlertProps) {
  const role = tone === 'danger' || tone === 'warning' ? 'alert' : 'status';
  return (
    <div className={`sa-alert sa-alert-${tone}`} role={role}>
      {title ? <p className="sa-alert-title">{title}</p> : null}
      <div className="sa-alert-body">{children}</div>
    </div>
  );
}
