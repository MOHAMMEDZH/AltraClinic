import { AnalyticsDomainPage } from '../components/AnalyticsDomainPage';

export function BranchAnalyticsPage() {
  return (
    <AnalyticsDomainPage
      domainId="branches"
      titleKey="analytics.domains.branches.title"
      subtitleKey="analytics.domains.branches.desc"
    />
  );
}
