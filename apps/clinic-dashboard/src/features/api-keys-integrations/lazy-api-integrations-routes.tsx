import { lazy, Suspense, type ReactNode } from 'react';
import { ApiIntegrationsLayout } from './components/ApiIntegrationsLayout';

const Overview = lazy(() =>
  import('./pages/OverviewPage').then((m) => ({ default: m.OverviewPage })),
);
const Credentials = lazy(() =>
  import('./pages/CredentialsPage').then((m) => ({ default: m.CredentialsPage })),
);
const CredentialCreate = lazy(() =>
  import('./pages/CredentialCreatePage').then((m) => ({
    default: m.CredentialCreatePage,
  })),
);
const CredentialDetail = lazy(() =>
  import('./pages/CredentialDetailPage').then((m) => ({
    default: m.CredentialDetailPage,
  })),
);
const ServiceAccounts = lazy(() =>
  import('./pages/ServiceAccountsPage').then((m) => ({
    default: m.ServiceAccountsPage,
  })),
);
const Scopes = lazy(() =>
  import('./pages/ScopesPage').then((m) => ({ default: m.ScopesPage })),
);
const Providers = lazy(() =>
  import('./pages/ProvidersPage').then((m) => ({ default: m.ProvidersPage })),
);
const Webhooks = lazy(() =>
  import('./pages/WebhooksPage').then((m) => ({ default: m.WebhooksPage })),
);
const Deliveries = lazy(() =>
  import('./pages/DeliveriesPage').then((m) => ({ default: m.DeliveriesPage })),
);
const Gateway = lazy(() =>
  import('./pages/GatewayPage').then((m) => ({ default: m.GatewayPage })),
);
const Quotas = lazy(() =>
  import('./pages/QuotasUsagePage').then((m) => ({ default: m.QuotasUsagePage })),
);
const Metrics = lazy(() =>
  import('./pages/MetricsAuditPage').then((m) => ({ default: m.MetricsAuditPage })),
);
const Permissions = lazy(() =>
  import('./pages/PermissionsPage').then((m) => ({ default: m.PermissionsPage })),
);
const Configuration = lazy(() =>
  import('./pages/ConfigurationPage').then((m) => ({
    default: m.ConfigurationPage,
  })),
);
const Health = lazy(() =>
  import('./pages/HealthPage').then((m) => ({ default: m.HealthPage })),
);

function Fallback() {
  return (
    <div style={{ padding: 'var(--space-6)' }} aria-busy="true" role="status">
      Loading…
    </div>
  );
}

function wrap(node: ReactNode) {
  return <Suspense fallback={<Fallback />}>{node}</Suspense>;
}

export function LazyApiIntegrationsLayout() {
  return wrap(<ApiIntegrationsLayout />);
}
export function LazyApiIntegrationsOverviewPage() {
  return wrap(<Overview />);
}
export function LazyApiIntegrationsCredentialsPage() {
  return wrap(<Credentials />);
}
export function LazyApiIntegrationsCredentialCreatePage() {
  return wrap(<CredentialCreate />);
}
export function LazyApiIntegrationsCredentialDetailPage() {
  return wrap(<CredentialDetail />);
}
export function LazyApiIntegrationsServiceAccountsPage() {
  return wrap(<ServiceAccounts />);
}
export function LazyApiIntegrationsScopesPage() {
  return wrap(<Scopes />);
}
export function LazyApiIntegrationsProvidersPage() {
  return wrap(<Providers />);
}
export function LazyApiIntegrationsWebhooksPage() {
  return wrap(<Webhooks />);
}
export function LazyApiIntegrationsDeliveriesPage() {
  return wrap(<Deliveries />);
}
export function LazyApiIntegrationsGatewayPage() {
  return wrap(<Gateway />);
}
export function LazyApiIntegrationsQuotasPage() {
  return wrap(<Quotas />);
}
export function LazyApiIntegrationsMetricsPage() {
  return wrap(<Metrics />);
}
export function LazyApiIntegrationsPermissionsPage() {
  return wrap(<Permissions />);
}
export function LazyApiIntegrationsConfigurationPage() {
  return wrap(<Configuration />);
}
export function LazyApiIntegrationsHealthPage() {
  return wrap(<Health />);
}
