import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Clock, CreditCard, FileText, LayoutDashboard, Package, Percent, Plus, Tags, Wallet } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import type { BillingWorkspaceMode } from '../config/billing-config';
import styles from '../billing-layout.module.css';

interface NavItem {
  id: string;
  path: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  modes: BillingWorkspaceMode[];
}

const ALL_MODES: BillingWorkspaceMode[] = ['finance', 'reception', 'management', 'clinical'];

const ITEMS: NavItem[] = [
  { id: 'dashboard', path: '/billing', labelKey: 'billing.nav.dashboard', icon: LayoutDashboard, modes: ALL_MODES },
  { id: 'invoices', path: '/billing/invoices', labelKey: 'billing.nav.invoices', icon: FileText, modes: ALL_MODES },
  { id: 'create', path: '/billing/invoices/new', labelKey: 'billing.nav.create', icon: Plus, modes: ['finance', 'reception', 'management'] },
  { id: 'outstanding', path: '/billing/outstanding', labelKey: 'billing.nav.outstanding', icon: Clock, modes: ['finance', 'management', 'reception'] },
  { id: 'pos', path: '/billing/pos', labelKey: 'billing.nav.pos', icon: CreditCard, modes: ['finance', 'reception', 'management'] },
  { id: 'cashbox', path: '/billing/cashbox', labelKey: 'billing.nav.cashbox', icon: Wallet, modes: ['finance', 'reception', 'management'] },
  { id: 'pricing', path: '/billing/pricing', labelKey: 'billing.nav.pricing', icon: Tags, modes: ['finance', 'management'] },
  { id: 'commissions', path: '/billing/commissions', labelKey: 'billing.nav.commissions', icon: Percent, modes: ['finance', 'management'] },
  { id: 'unbilled', path: '/billing/unbilled', labelKey: 'billing.nav.unbilled', icon: Package, modes: ALL_MODES },
  { id: 'reports', path: '/billing/reports', labelKey: 'billing.nav.reports', icon: BarChart3, modes: ['finance', 'management'] },
];

interface BillingQuickNavProps {
  mode: BillingWorkspaceMode;
  canCreate?: boolean;
}

export function BillingQuickNav({ mode, canCreate = false }: BillingQuickNavProps) {
  const { t } = useI18n();
  const location = useLocation();

  const visible = ITEMS.filter((item) => {
    if (item.id === 'create' && !canCreate) return false;
    return item.modes.includes(mode);
  });

  return (
    <nav className={styles.quickNav} aria-label={t('billing.nav.label')}>
      {visible.map((item) => {
        const Icon = item.icon;
        const active =
          item.path === '/billing'
            ? location.pathname === '/billing'
            : location.pathname.startsWith(item.path);
        return (
          <Link
            key={item.id}
            to={item.path}
            className={styles.quickNavLink}
            aria-current={active ? 'page' : undefined}
            style={active ? { borderColor: 'var(--color-primary-500)' } : undefined}
          >
            <Icon size={18} className={styles.quickNavIcon} aria-hidden />
            <span className={styles.quickNavLabel}>{t(item.labelKey as 'billing.nav.dashboard')}</span>
          </Link>
        );
      })}
    </nav>
  );
}
