import { AnalyticsDomainPage } from '../components/AnalyticsDomainPage';

export function InventoryAnalyticsPage() {
  return (
    <AnalyticsDomainPage
      domainId="inventory"
      titleKey="analytics.domains.inventory.title"
      subtitleKey="analytics.domains.inventory.desc"
    />
  );
}
