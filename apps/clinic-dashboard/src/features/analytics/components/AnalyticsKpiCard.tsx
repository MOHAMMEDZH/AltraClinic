import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from '../analytics-layout.module.css';

interface AnalyticsKpiCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  href?: string;
}

export function AnalyticsKpiCard({ label, value, hint, href }: AnalyticsKpiCardProps) {
  const className = [styles.kpiCard, href ? styles.kpiCardLink : ''].filter(Boolean).join(' ');

  const content = (
    <>
      <p className={styles.kpiLabel}>{label}</p>
      <p className={styles.kpiValue}>{value}</p>
      {hint ? <p className={styles.kpiHint}>{hint}</p> : null}
    </>
  );

  if (href) {
    const isInternal = href.startsWith('/');
    return isInternal ? (
      <Link className={className} to={href}>
        {content}
      </Link>
    ) : (
      <a className={className} href={href}>
        {content}
      </a>
    );
  }

  return <article className={className}>{content}</article>;
}
