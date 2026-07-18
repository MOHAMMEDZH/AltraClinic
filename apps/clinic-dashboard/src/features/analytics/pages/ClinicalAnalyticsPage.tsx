import { AnalyticsDomainPage } from '../components/AnalyticsDomainPage';

export function ClinicalAnalyticsPage() {
  return (
    <AnalyticsDomainPage
      domainId="clinical"
      titleKey="analytics.domains.clinical.title"
      subtitleKey="analytics.domains.clinical.desc"
    />
  );
}
