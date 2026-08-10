import { useI18n } from '@booking/i18n/react';
import { MetricCard } from './MetricCard';
import type { DashboardSection } from './types';

interface SectionBlockProps {
  section: DashboardSection;
}

/** A dashboard section: localized heading + a responsive grid of metric cards. */
export function SectionBlock({ section }: SectionBlockProps) {
  const { t } = useI18n();
  return (
    <section className="sa-dashboard-section" aria-labelledby={`section-${section.id}`}>
      <h2 id={`section-${section.id}`} className="sa-dashboard-section-title">
        {t(`dashboard.sections.${section.id}`, section.id)}
      </h2>
      <div className="sa-dashboard-grid">
        {section.metrics.map((metric) => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
      </div>
    </section>
  );
}
