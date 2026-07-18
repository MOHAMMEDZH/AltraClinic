import { Link } from 'react-router-dom';
import styles from '../DashboardPage.module.css';

interface KpiDrillCardProps {
  label: string;
  value: string;
  to: string;
  ariaLabel: string;
}

export function KpiDrillCard({ label, value, to, ariaLabel }: KpiDrillCardProps) {
  return (
    <Link className={[styles.kpiCard, styles.kpiCardLink].join(' ')} to={to} aria-label={ariaLabel}>
      <p className={styles.kpiLabel}>{label}</p>
      <p className={styles.kpiValue}>{value}</p>
    </Link>
  );
}

interface WidgetDrillLinkProps {
  to: string;
  label: string;
}

export function WidgetDrillLink({ to, label }: WidgetDrillLinkProps) {
  return (
    <Link className={styles.drillLink} to={to}>
      {label}
    </Link>
  );
}
