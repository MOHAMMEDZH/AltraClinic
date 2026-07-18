import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { useExportInvoices } from '@/features/billing/hooks/useBilling';
import { downloadBillingCsv } from '@/features/billing/utils/billing-export';
import { mapUiPlanToBackend, PLAN_CATALOG, type SubscriptionPlanId } from '../config/subscription-config';
import { VirtualizedTenantsTable } from '../components/VirtualizedTenantsTable';
import { GrantTenantTrialModal } from '../components/GrantTenantTrialModal';
import { TenantEntitlementModal, type EntitlementGrantType } from '../components/TenantEntitlementModal';
import {
  useActivatePlatformTenant,
  useChangePlatformPlan,
  useDebouncedSearch,
  usePlatformTenants,
  useGrantTenantEntitlements,
  useGrantTenantTrial,
  useResumePlatformTenant,
  useSubscriptionAccess,
  useSuspendPlatformTenant,
} from '../hooks/useSubscription';
import { downloadSubscriptionCsv } from '../lib/subscription-export';
import styles from '../subscription-layout.module.css';
import type { PlatformTenantListItem } from '../types/subscription.types';

export function SubscriptionAdminPage() {
  const { t } = useI18n();
  const access = useSubscriptionAccess();
  const search = useDebouncedSearch();
  const exportInvoices = useExportInvoices();
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [trialTenant, setTrialTenant] = useState<PlatformTenantListItem | null>(null);
  const [grantState, setGrantState] = useState<{ tenant: PlatformTenantListItem; type: EntitlementGrantType } | null>(
    null,
  );
  const tenants = usePlatformTenants(access.canViewPlatform, {
    search: search.debounced,
    plan: planFilter || undefined,
    status: statusFilter || undefined,
  });
  const changePlan = useChangePlatformPlan();
  const suspend = useSuspendPlatformTenant();
  const resume = useResumePlatformTenant();
  const activate = useActivatePlatformTenant();
  const grantEntitlements = useGrantTenantEntitlements();
  const grantTrial = useGrantTenantTrial();

  const labels = useMemo(
    () => ({
      tenant: t('subscription.superAdmin.tenant'),
      plan: t('subscription.superAdmin.plan'),
      status: t('subscription.superAdmin.status'),
      users: t('subscription.table.users'),
      branches: t('subscription.table.branches'),
      actions: t('subscription.superAdmin.actions'),
    }),
    [t],
  );

  function exportTenants() {
    const rows = [
      [t('subscription.superAdmin.tenant'), t('subscription.superAdmin.plan'), t('subscription.superAdmin.status')],
      ...(tenants.data ?? []).map((tenant) => [tenant.displayName, tenant.plan, tenant.status]),
    ];
    downloadSubscriptionCsv('platform-tenants.csv', rows);
  }

  if (!access.canViewPlatform) {
    return (
      <div className={styles.page}>
        <p className={styles.empty}>{t('subscription.accessDenied')}</p>
      </div>
    );
  }

  if (tenants.isLoading) {
    return <div className={styles.skeleton} role="status" aria-busy="true" aria-label={t('subscription.loading')} />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('subscription.nav.admin')}</h2>
          <p className={styles.pageSubtitle}>{t('subscription.superAdmin.subtitle')}</p>
        </div>
        <div className={styles.actions}>
          <AuthButton variant="secondary" onClick={exportTenants}>
            {t('subscription.actions.export')}
          </AuthButton>
          <AuthButton
            variant="secondary"
            loading={exportInvoices.isPending}
            onClick={() =>
              void exportInvoices.mutateAsync({}).then((result) => downloadBillingCsv(result.filename, result.csv))
            }
          >
            {t('subscription.actions.exportInvoices')}
          </AuthButton>
        </div>
      </header>

      {(tenants.isError || changePlan.isError) && <AuthAlert variant="error">{t('subscription.loadError')}</AuthAlert>}

      <div className={styles.toolbar}>
        <input
          className={styles.input}
          type="search"
          value={search.value}
          onChange={(e) => search.onChange(e.target.value)}
          placeholder={t('subscription.superAdmin.search')}
          aria-label={t('subscription.superAdmin.search')}
        />
        <select
          className={styles.select}
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          aria-label={t('subscription.superAdmin.filterPlan')}
        >
          <option value="">{t('subscription.superAdmin.allPlans')}</option>
          {PLAN_CATALOG.map((plan) => (
            <option key={plan.id} value={plan.backendPlan}>
              {t(`subscription.plans.${plan.id}`)}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label={t('subscription.superAdmin.filterStatus')}
        >
          <option value="">{t('subscription.superAdmin.allStatuses')}</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
          <option value="PROVISIONED">PROVISIONED</option>
        </select>
      </div>

      {tenants.data?.length ? (
        <VirtualizedTenantsTable
          tenants={tenants.data}
          ariaLabel={t('subscription.superAdmin.title')}
          labels={labels}
          renderActions={(tenant) => (
            <TenantActions
              tenant={tenant}
              canManage={access.canManagePlatform}
              onChangePlan={(planId) =>
                changePlan.mutate({ platformTenantId: tenant.platformTenantId, plan: mapUiPlanToBackend(planId) })
              }
              onSuspend={() => suspend.mutate({ platformTenantId: tenant.platformTenantId, reason: 'admin_action' })}
              onResume={() => resume.mutate(tenant.platformTenantId)}
              onActivate={() => activate.mutate(tenant.platformTenantId)}
              onGrantTrial={() => setTrialTenant(tenant)}
              onGrant={(type) => setGrantState({ tenant, type })}
              t={t}
            />
          )}
        />
      ) : (
        <p className={styles.empty}>{t('subscription.superAdmin.empty')}</p>
      )}

      {trialTenant && (
        <GrantTenantTrialModal
          open
          tenantName={trialTenant.displayName}
          loading={grantTrial.isPending}
          onClose={() => setTrialTenant(null)}
          onConfirm={(planId, days) => {
            grantTrial.mutate(
              {
                platformTenantId: trialTenant.platformTenantId,
                plan: planId,
                days,
              },
              { onSettled: () => setTrialTenant(null) },
            );
          }}
        />
      )}

      {grantState && (
        <TenantEntitlementModal
          open
          tenantName={grantState.tenant.displayName}
          grantType={grantState.type}
          loading={grantEntitlements.isPending}
          onClose={() => setGrantState(null)}
          onConfirm={(amount, note) => {
            grantEntitlements.mutate(
              {
                platformTenantId: grantState.tenant.platformTenantId,
                grantType: grantState.type,
                amount,
                note,
              },
              { onSettled: () => setGrantState(null) },
            );
          }}
        />
      )}
    </div>
  );
}

function TenantActions({
  tenant,
  canManage,
  onChangePlan,
  onSuspend,
  onResume,
  onActivate,
  onGrantTrial,
  onGrant,
  t,
}: {
  tenant: PlatformTenantListItem;
  canManage: boolean;
  onChangePlan: (planId: SubscriptionPlanId) => void;
  onSuspend: () => void;
  onResume: () => void;
  onActivate: () => void;
  onGrantTrial: () => void;
  onGrant: (type: EntitlementGrantType) => void;
  t: (key: string) => string;
}) {
  if (!canManage) return null;

  const nextPlan: SubscriptionPlanId =
    tenant.plan === 'lite' ? 'professional' : tenant.plan === 'pro' ? 'enterprise' : 'starter';

  return (
    <div className={styles.actions}>
      <AuthButton variant="secondary" onClick={() => onChangePlan(nextPlan)}>
        {t('subscription.superAdmin.togglePlan')}
      </AuthButton>
      <AuthButton variant="secondary" onClick={onGrantTrial}>
        {t('subscription.superAdmin.grantTrial')}
      </AuthButton>
      <AuthButton variant="secondary" onClick={() => onGrant('aiCredits')}>
        {t('subscription.superAdmin.grantAiCredits')}
      </AuthButton>
      <AuthButton variant="secondary" onClick={() => onGrant('storage')}>
        {t('subscription.superAdmin.grantStorage')}
      </AuthButton>
      <AuthButton variant="secondary" onClick={() => onGrant('users')}>
        {t('subscription.superAdmin.grantUsers')}
      </AuthButton>
      {tenant.status === 'SUSPENDED' ? (
        <AuthButton onClick={onResume}>{t('subscription.superAdmin.resume')}</AuthButton>
      ) : (
        <AuthButton variant="secondary" onClick={onSuspend}>
          {t('subscription.superAdmin.suspend')}
        </AuthButton>
      )}
      {tenant.status === 'PROVISIONED' && (
        <AuthButton onClick={onActivate}>{t('subscription.superAdmin.activate')}</AuthButton>
      )}
      <Link className={styles.navLink} to={`/settings/subscription/license`}>
        {t('subscription.nav.license')}
      </Link>
    </div>
  );
}
