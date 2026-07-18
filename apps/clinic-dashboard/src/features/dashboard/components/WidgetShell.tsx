import type { ReactNode } from 'react';
import styles from '../DashboardPage.module.css';

interface WidgetShellProps {
  title: string;
  description?: string;
  footer?: ReactNode;
  span?: 'full' | 'half' | 'third' | 'two-thirds';
  children: ReactNode;
  action?: ReactNode;
}

const spanClass: Record<NonNullable<WidgetShellProps['span']>, string> = {
  full: styles.spanFull,
  half: styles.spanHalf,
  third: styles.spanThird,
  'two-thirds': styles.spanTwoThirds,
};

export function WidgetShell({
  title,
  description,
  footer,
  span = 'half',
  children,
  action,
}: WidgetShellProps) {
  return (
    <section className={[styles.widget, spanClass[span]].join(' ')} aria-labelledby={`widget-${title}`}>
      <header className={styles.widgetHeader}>
        <div>
          <h2 className={styles.widgetTitle} id={`widget-${title}`}>
            {title}
          </h2>
          {description && <p className={styles.widgetDesc}>{description}</p>}
        </div>
        {action}
      </header>
      <div className={styles.widgetBody}>{children}</div>
      {footer && <footer className={styles.widgetFooter}>{footer}</footer>}
    </section>
  );
}

export function WidgetSkeleton({ span = 'half' }: { span?: WidgetShellProps['span'] }) {
  return (
    <div
      className={[styles.widget, spanClass[span]].join(' ')}
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >      <div className={styles.widgetBody}>
        <div className={styles.skeleton}>
          <div className={styles.skeletonBlock} />
          <div className={styles.skeletonBlock} style={{ width: '70%' }} />
          <div className={styles.skeletonBlock} style={{ width: '50%' }} />
        </div>
      </div>
    </div>
  );
}

export function WidgetEmpty({ message }: { message: string }) {
  return <div className={styles.empty}>{message}</div>;
}

export function WidgetError({ message }: { message: string }) {
  return (
    <div className={styles.error} role="alert">
      {message}
    </div>
  );
}
