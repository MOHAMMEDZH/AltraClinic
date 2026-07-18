import { AnalyticsDomainPage } from '../components/AnalyticsDomainPage';

export function PatientAnalyticsPage() {
  return (
    <AnalyticsDomainPage
      domainId="patients"
      titleKey="analytics.domains.patients.title"
      subtitleKey="analytics.domains.patients.desc"
    />
  );
}
