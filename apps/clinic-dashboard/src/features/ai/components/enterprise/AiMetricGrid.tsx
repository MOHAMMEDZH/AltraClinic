import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import e from '../../ai-enterprise.module.css';

export interface AiMetricItem {
  id: string;
  label: string;
  value: string | number;
  meta?: string;
  href?: string;
  icon?: LucideIcon;
}

export function AiMetricGrid({ items }: { items: AiMetricItem[] }) {
  return (
    <div className={e.metricGrid}>
      {items.map((item) => {
        const inner = (
          <>
            <p className={e.metricLabel}>{item.label}</p>
            <p className={e.metricValue}>{item.value}</p>
            {item.meta && <p className={e.metricMeta}>{item.meta}</p>}
          </>
        );
        if (item.href) {
          return (
            <Link key={item.id} to={item.href} className={e.metricCard}>
              {inner}
            </Link>
          );
        }
        return (
          <div key={item.id} className={e.metricCard}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
