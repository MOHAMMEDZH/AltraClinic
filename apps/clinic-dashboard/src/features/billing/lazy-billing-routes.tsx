import { lazy, Suspense } from 'react';

const BillingDashboardPage = lazy(() =>
  import('./BillingDashboardPage').then((m) => ({ default: m.BillingDashboardPage })),
);

const BillingInvoicesPage = lazy(() =>
  import('./BillingInvoicesPage').then((m) => ({ default: m.BillingInvoicesPage })),
);

const CreateInvoicePage = lazy(() =>
  import('./CreateInvoicePage').then((m) => ({ default: m.CreateInvoicePage })),
);

const InvoiceDetailPage = lazy(() =>
  import('./InvoiceDetailPage').then((m) => ({ default: m.InvoiceDetailPage })),
);

const OutstandingPage = lazy(() =>
  import('./OutstandingPage').then((m) => ({ default: m.OutstandingPage })),
);

const UnbilledPage = lazy(() => import('./UnbilledPage').then((m) => ({ default: m.UnbilledPage })));

const CashboxPage = lazy(() => import('./CashboxPage').then((m) => ({ default: m.CashboxPage })));

const PricingPage = lazy(() => import('./PricingPage').then((m) => ({ default: m.PricingPage })));

const PosCheckoutPage = lazy(() => import('./PosCheckoutPage').then((m) => ({ default: m.PosCheckoutPage })));

const BillingReportsPage = lazy(() =>
  import('./BillingReportsPage').then((m) => ({ default: m.BillingReportsPage })),
);

const ReceiptPrintPage = lazy(() =>
  import('./ReceiptPrintPage').then((m) => ({ default: m.ReceiptPrintPage })),
);

const CommissionPage = lazy(() => import('./CommissionPage').then((m) => ({ default: m.CommissionPage })));

const CommissionRulesPage = lazy(() => import('./CommissionRulesPage').then((m) => ({ default: m.CommissionRulesPage })));

function BillingFallback() {
  return <div style={{ padding: 'var(--space-6)' }} aria-busy="true" />;
}

export function LazyBillingDashboardPage() {
  return (
    <Suspense fallback={<BillingFallback />}>
      <BillingDashboardPage />
    </Suspense>
  );
}

export function LazyBillingInvoicesPage() {
  return (
    <Suspense fallback={<BillingFallback />}>
      <BillingInvoicesPage />
    </Suspense>
  );
}

export function LazyCreateInvoicePage() {
  return (
    <Suspense fallback={<BillingFallback />}>
      <CreateInvoicePage />
    </Suspense>
  );
}

export function LazyInvoiceDetailPage() {
  return (
    <Suspense fallback={<BillingFallback />}>
      <InvoiceDetailPage />
    </Suspense>
  );
}

export function LazyOutstandingPage() {
  return (
    <Suspense fallback={<BillingFallback />}>
      <OutstandingPage />
    </Suspense>
  );
}

export function LazyUnbilledPage() {
  return (
    <Suspense fallback={<BillingFallback />}>
      <UnbilledPage />
    </Suspense>
  );
}

export function LazyCashboxPage() {
  return (
    <Suspense fallback={<BillingFallback />}>
      <CashboxPage />
    </Suspense>
  );
}

export function LazyPricingPage() {
  return (
    <Suspense fallback={<BillingFallback />}>
      <PricingPage />
    </Suspense>
  );
}

export function LazyPosCheckoutPage() {
  return (
    <Suspense fallback={<BillingFallback />}>
      <PosCheckoutPage />
    </Suspense>
  );
}

export function LazyBillingReportsPage() {
  return (
    <Suspense fallback={<BillingFallback />}>
      <BillingReportsPage />
    </Suspense>
  );
}

export function LazyReceiptPrintPage() {
  return (
    <Suspense fallback={<BillingFallback />}>
      <ReceiptPrintPage />
    </Suspense>
  );
}

export function LazyCommissionPage() {
  return (
    <Suspense fallback={<BillingFallback />}>
      <CommissionPage />
    </Suspense>
  );
}

export function LazyCommissionRulesPage() {
  return (
    <Suspense fallback={<BillingFallback />}>
      <CommissionRulesPage />
    </Suspense>
  );
}
