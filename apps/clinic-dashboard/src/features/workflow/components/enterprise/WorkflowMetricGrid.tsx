import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import e from '../../workflow-enterprise.module.css';

export interface WorkflowMetricItem {
  id: string;
  label: string;
  value: string | number;
  meta?: string;
  href?: string;
  icon: LucideIcon;
  accent?: 'success' | 'warning' | 'danger' | 'info';
}

interface WorkflowMetricGridProps {
  items: WorkflowMetricItem[];
}

export function WorkflowMetricGrid({ items }: WorkflowMetricGridProps) {
  return (
    <div className={e.metricGrid}>
      {items.map((item) => {
        const accentClass =
          item.accent === 'success'
            ? e.metricAccentSuccess
            : item.accent === 'warning'
              ? e.metricAccentWarning
              : item.accent === 'danger'
                ? e.metricAccentDanger
                : e.metricAccentInfo;
        const Icon = item.icon;
        const inner = (
          <>
            <div className={e.metricTop}>
              <p className={e.metricLabel}>{item.label}</p>
              <span className={e.metricIcon} aria-hidden>
                <Icon size={16} />
              </span>
            </div>
            <p className={e.metricValue}>{item.value}</p>
            {item.meta && <p className={e.metricMeta}>{item.meta}</p>}
          </>
        );
        if (item.href) {
          return (
            <Link key={item.id} to={item.href} className={[e.metricCard, accentClass].join(' ')}>
              {inner}
            </Link>
          );
        }
        return (
          <div key={item.id} className={[e.metricCard, e.metricCardStatic, accentClass].join(' ')}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
