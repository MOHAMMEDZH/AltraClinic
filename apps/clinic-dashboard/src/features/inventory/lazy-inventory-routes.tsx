import { lazy, Suspense } from 'react';

const InventoryDashboardPage = lazy(() =>
  import('./InventoryDashboardPage').then((m) => ({ default: m.InventoryDashboardPage })),
);

const InventoryPage = lazy(() =>
  import('./InventoryPage').then((m) => ({ default: m.InventoryPage })),
);

const InventoryItemDetailPage = lazy(() =>
  import('./InventoryItemDetailPage').then((m) => ({ default: m.InventoryItemDetailPage })),
);

const ExpiryPage = lazy(() =>
  import('./ExpiryPage').then((m) => ({ default: m.ExpiryPage })),
);

const SuppliersPage = lazy(() =>
  import('./SuppliersPage').then((m) => ({ default: m.SuppliersPage })),
);

const ProcurementPage = lazy(() =>
  import('./ProcurementPage').then((m) => ({ default: m.ProcurementPage })),
);

const WarehousesPage = lazy(() =>
  import('./WarehousesPage').then((m) => ({ default: m.WarehousesPage })),
);

const TransfersPage = lazy(() =>
  import('./TransfersPage').then((m) => ({ default: m.TransfersPage })),
);

const StockCountsPage = lazy(() =>
  import('./StockCountsPage').then((m) => ({ default: m.StockCountsPage })),
);

const StockRequestsPage = lazy(() =>
  import('./StockRequestsPage').then((m) => ({ default: m.StockRequestsPage })),
);

const InventoryReportsPage = lazy(() =>
  import('./InventoryReportsPage').then((m) => ({ default: m.InventoryReportsPage })),
);

const WarehouseDetailPage = lazy(() =>
  import('./WarehouseDetailPage').then((m) => ({ default: m.WarehouseDetailPage })),
);

const CategoriesPage = lazy(() =>
  import('./CategoriesPage').then((m) => ({ default: m.CategoriesPage })),
);

const SupplierDetailPage = lazy(() =>
  import('./SupplierDetailPage').then((m) => ({ default: m.SupplierDetailPage })),
);

function InventoryFallback() {
  return <div style={{ padding: 'var(--space-6)' }} aria-busy="true" />;
}

export function LazyInventoryDashboardPage() {
  return (
    <Suspense fallback={<InventoryFallback />}>
      <InventoryDashboardPage />
    </Suspense>
  );
}

export function LazyInventoryPage() {
  return (
    <Suspense fallback={<InventoryFallback />}>
      <InventoryPage />
    </Suspense>
  );
}

export function LazyInventoryItemDetailPage() {
  return (
    <Suspense fallback={<InventoryFallback />}>
      <InventoryItemDetailPage />
    </Suspense>
  );
}

export function LazyExpiryPage() {
  return (
    <Suspense fallback={<InventoryFallback />}>
      <ExpiryPage />
    </Suspense>
  );
}

export function LazySuppliersPage() {
  return (
    <Suspense fallback={<InventoryFallback />}>
      <SuppliersPage />
    </Suspense>
  );
}

export function LazyProcurementPage() {
  return (
    <Suspense fallback={<InventoryFallback />}>
      <ProcurementPage />
    </Suspense>
  );
}

export function LazyWarehousesPage() {
  return (
    <Suspense fallback={<InventoryFallback />}>
      <WarehousesPage />
    </Suspense>
  );
}

export function LazyTransfersPage() {
  return (
    <Suspense fallback={<InventoryFallback />}>
      <TransfersPage />
    </Suspense>
  );
}

export function LazyStockCountsPage() {
  return (
    <Suspense fallback={<InventoryFallback />}>
      <StockCountsPage />
    </Suspense>
  );
}

export function LazyStockRequestsPage() {
  return (
    <Suspense fallback={<InventoryFallback />}>
      <StockRequestsPage />
    </Suspense>
  );
}

export function LazyInventoryReportsPage() {
  return (
    <Suspense fallback={<InventoryFallback />}>
      <InventoryReportsPage />
    </Suspense>
  );
}

export function LazyWarehouseDetailPage() {
  return (
    <Suspense fallback={<InventoryFallback />}>
      <WarehouseDetailPage />
    </Suspense>
  );
}

export function LazyCategoriesPage() {
  return (
    <Suspense fallback={<InventoryFallback />}>
      <CategoriesPage />
    </Suspense>
  );
}

export function LazySupplierDetailPage() {
  return (
    <Suspense fallback={<InventoryFallback />}>
      <SupplierDetailPage />
    </Suspense>
  );
}
