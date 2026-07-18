export type AnalyticsDomainId =
  | 'executive'
  | 'financial'
  | 'patients'
  | 'operations'
  | 'inventory'
  | 'clinical'
  | 'dental'
  | 'beauty'
  | 'staff'
  | 'branches'
  | 'forecasting';

export interface AnalyticsDomain {
  id: AnalyticsDomainId;
  route: string;
  titleKey: string;
  descriptionKey: string;
  icon: 'layout' | 'revenue' | 'patients' | 'calendar' | 'inventory' | 'clinical' | 'dental' | 'beauty' | 'staff' | 'branches' | 'forecast';
}

export const ANALYTICS_DOMAINS: AnalyticsDomain[] = [
  {
    id: 'executive',
    route: '/analytics/executive',
    titleKey: 'analytics.domains.executive.title',
    descriptionKey: 'analytics.domains.executive.desc',
    icon: 'layout',
  },
  {
    id: 'financial',
    route: '/analytics/financial',
    titleKey: 'analytics.domains.financial.title',
    descriptionKey: 'analytics.domains.financial.desc',
    icon: 'revenue',
  },
  {
    id: 'patients',
    route: '/analytics/patients',
    titleKey: 'analytics.domains.patients.title',
    descriptionKey: 'analytics.domains.patients.desc',
    icon: 'patients',
  },
  {
    id: 'operations',
    route: '/analytics/operations',
    titleKey: 'analytics.domains.operations.title',
    descriptionKey: 'analytics.domains.operations.desc',
    icon: 'calendar',
  },
  {
    id: 'inventory',
    route: '/analytics/inventory',
    titleKey: 'analytics.domains.inventory.title',
    descriptionKey: 'analytics.domains.inventory.desc',
    icon: 'inventory',
  },
  {
    id: 'clinical',
    route: '/analytics/clinical',
    titleKey: 'analytics.domains.clinical.title',
    descriptionKey: 'analytics.domains.clinical.desc',
    icon: 'clinical',
  },
  {
    id: 'dental',
    route: '/analytics/dental',
    titleKey: 'analytics.domains.dental.title',
    descriptionKey: 'analytics.domains.dental.desc',
    icon: 'dental',
  },
  {
    id: 'beauty',
    route: '/analytics/beauty',
    titleKey: 'analytics.domains.beauty.title',
    descriptionKey: 'analytics.domains.beauty.desc',
    icon: 'beauty',
  },
  {
    id: 'staff',
    route: '/analytics/staff',
    titleKey: 'analytics.domains.staff.title',
    descriptionKey: 'analytics.domains.staff.desc',
    icon: 'staff',
  },
  {
    id: 'branches',
    route: '/analytics/branches',
    titleKey: 'analytics.domains.branches.title',
    descriptionKey: 'analytics.domains.branches.desc',
    icon: 'branches',
  },
  {
    id: 'forecasting',
    route: '/analytics/forecasting',
    titleKey: 'analytics.domains.forecasting.title',
    descriptionKey: 'analytics.domains.forecasting.desc',
    icon: 'forecast',
  },
];

export function findAnalyticsDomain(id: string): AnalyticsDomain | undefined {
  return ANALYTICS_DOMAINS.find((domain) => domain.id === id);
}
