import { Link } from 'react-router-dom';
import {
  ArrowLeftRight,
  BarChart3,
  ClipboardList,
  Package,
  ShoppingCart,
  Truck,
  Warehouse,
  AlertTriangle,
  Users,
  Tags,
} from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import type { InventoryWorkspaceMode } from '../config/inventory-config';
import styles from '../InventoryDashboardPage.module.css';

interface QuickNavItem {
  id: string;
  path: string;
  labelKey: string;
  icon: typeof Package;
  modes: InventoryWorkspaceMode[];
}

const STAFF_MODES: InventoryWorkspaceMode[] = ['operations', 'management'];

const ITEMS: QuickNavItem[] = [
  {
    id: 'catalog',
    path: '/inventory/catalog',
    labelKey: 'inventory.dashboard.nav.catalog',
    icon: Package,
    modes: [...STAFF_MODES, 'clinical', 'lookup'],
  },
  {
    id: 'expiry',
    path: '/inventory/expiry',
    labelKey: 'inventory.dashboard.nav.expiry',
    icon: AlertTriangle,
    modes: [...STAFF_MODES, 'clinical'],
  },
  {
    id: 'procurement',
    path: '/inventory/procurement',
    labelKey: 'inventory.dashboard.nav.procurement',
    icon: ShoppingCart,
    modes: STAFF_MODES,
  },
  {
    id: 'suppliers',
    path: '/inventory/suppliers',
    labelKey: 'inventory.dashboard.nav.suppliers',
    icon: Users,
    modes: STAFF_MODES,
  },
  {
    id: 'categories',
    path: '/inventory/categories',
    labelKey: 'inventory.dashboard.nav.categories',
    icon: Tags,
    modes: STAFF_MODES,
  },
  {
    id: 'warehouses',
    path: '/inventory/warehouses',
    labelKey: 'inventory.dashboard.nav.warehouses',
    icon: Warehouse,
    modes: STAFF_MODES,
  },
  {
    id: 'transfers',
    path: '/inventory/transfers',
    labelKey: 'inventory.dashboard.nav.transfers',
    icon: Truck,
    modes: STAFF_MODES,
  },
  {
    id: 'stockCounts',
    path: '/inventory/stock-counts',
    labelKey: 'inventory.dashboard.nav.stockCounts',
    icon: ClipboardList,
    modes: STAFF_MODES,
  },
  {
    id: 'stockRequests',
    path: '/inventory/stock-requests',
    labelKey: 'inventory.dashboard.nav.stockRequests',
    icon: ArrowLeftRight,
    modes: [...STAFF_MODES, 'clinical'],
  },
  {
    id: 'reports',
    path: '/inventory/reports',
    labelKey: 'inventory.dashboard.nav.reports',
    icon: BarChart3,
    modes: STAFF_MODES,
  },
];

interface InventoryQuickNavProps {
  mode: InventoryWorkspaceMode;
}

export function InventoryQuickNav({ mode }: InventoryQuickNavProps) {
  const { t } = useI18n();
  const visible = ITEMS.filter((item) => item.modes.includes(mode));

  return (
    <nav className={styles.quickNav} aria-label={t('inventory.dashboard.quickNav')}>
      {visible.map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.id} to={item.id === 'catalog' && mode === 'lookup' ? '/inventory/catalog?scan=1' : item.path} className={styles.quickNavLink}>
            <Icon size={20} className={styles.quickNavIcon} aria-hidden />
            <span className={styles.quickNavLabel}>{t(item.labelKey as 'inventory.dashboard.nav.catalog')}</span>
          </Link>
        );
      })}
    </nav>
  );
}
