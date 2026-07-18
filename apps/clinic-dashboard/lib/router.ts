export type RouteDefinition = {
  path: string;
  label: string;
};

export const routes: RouteDefinition[] = [
  { path: '/', label: 'Home' },
  { path: '/patients', label: 'Patients' },
  { path: '/appointments', label: 'Appointments' },
  { path: '/billing', label: 'Billing' },
  { path: '/settings', label: 'Settings' },
];
