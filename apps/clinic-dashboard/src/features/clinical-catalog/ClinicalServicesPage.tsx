import { FormEvent, useEffect, useState } from 'react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { useSettingsBranches } from '@/features/settings/hooks/useSettings';
import type { ClinicalCatalogService, TenantServiceConfig } from './api/clinical-catalog-api';
import {
  useClinicalServices,
  useCreateTenantClinicalService,
  usePublishClinicalService,
  useTenantServiceConfigs,
  useUpsertTenantServiceConfig,
} from './hooks/useClinicalCatalog';
import styles from '../billing/billing-layout.module.css';

/** Empty string = tenant default scope. */
export const TENANT_DEFAULT_SCOPE = '';

function tr(service: ClinicalCatalogService, locale: string): string {
  return service.translations.find((t) => t.locale === locale)?.displayName ?? service.stableKey;
}

function resolveConfigForScope(
  configs: TenantServiceConfig[] | undefined,
  clinicalServiceId: string,
  branchId: string | null,
): { config: TenantServiceConfig | null; inherited: boolean } {
  const items = configs ?? [];
  if (branchId) {
    const override = items.find(
      (c) => c.clinicalServiceId === clinicalServiceId && c.branchId === branchId,
    );
    if (override) return { config: override, inherited: false };
  }
  const tenantDefault = items.find(
    (c) => c.clinicalServiceId === clinicalServiceId && c.branchId === null,
  );
  return {
    config: tenantDefault ?? null,
    inherited: Boolean(branchId && tenantDefault),
  };
}

export function ClinicalServicesPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const tenantId = user?.tenantId ?? '';

  const canView = hasPermission(roles, 'api.clinical-catalog', 'view');
  const canCreate = hasPermission(roles, 'api.clinical-catalog', 'create');
  const canUpdate = hasPermission(roles, 'api.clinical-catalog', 'update');
  const canManage = hasPermission(roles, 'api.clinical-catalog', 'manage');

  const [scopeBranchId, setScopeBranchId] = useState(TENANT_DEFAULT_SCOPE);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [keySuffix, setKeySuffix] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');

  useEffect(() => {
    const tmr = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(tmr);
  }, [search]);

  const servicesQuery = useClinicalServices(canView, debouncedSearch || undefined);
  const configsQuery = useTenantServiceConfigs(canView, { scope: 'all' });
  const branchesQuery = useSettingsBranches(canView);
  const createMutation = useCreateTenantClinicalService();
  const publishMutation = usePublishClinicalService();
  const configMutation = useUpsertTenantServiceConfig();

  const selectedBranchId = scopeBranchId || null;
  const items = servicesQuery.data ?? [];

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('clinicalCatalog.accessDenied')}</AuthAlert>
      </div>
    );
  }

  async function submitCreate(e: FormEvent) {
    e.preventDefault();
    if (!canCreate || !tenantId || !keySuffix.trim()) return;
    const stableKey = `tenant.${tenantId}.custom.${keySuffix.trim().toLowerCase().replace(/\s+/g, '_')}`;
    await createMutation.mutateAsync({
      stableKey,
      translations: [
        { locale: 'en', displayName: nameEn.trim() },
        { locale: 'ar', displayName: nameAr.trim() },
      ],
    });
    setKeySuffix('');
    setNameEn('');
    setNameAr('');
    setShowCreate(false);
  }

  async function toggleEnabled(service: ClinicalCatalogService, enabled: boolean) {
    if (!canUpdate) return;
    await configMutation.mutateAsync({
      clinicalServiceId: service.id,
      branchId: selectedBranchId,
      enabled,
    });
  }

  const displayLocale = locale.startsWith('ar') ? 'ar' : 'en';
  const scopeLabel = selectedBranchId
    ? (branchesQuery.data ?? []).find((b) => b.id === selectedBranchId)?.name ?? selectedBranchId
    : t('clinicalCatalog.scope.tenantDefault');

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('clinicalCatalog.title')}</h1>
          <p className={styles.subtitle}>{t('clinicalCatalog.subtitle')}</p>
        </div>
      </header>

      <AuthAlert variant="info">{t('clinicalCatalog.boundary')}</AuthAlert>

      <section className={styles.panel}>
        <div className={styles.formGrid}>
          <label>
            {t('clinicalCatalog.scope.label')}
            <select
              value={scopeBranchId}
              onChange={(e) => setScopeBranchId(e.target.value)}
              data-testid="clinical-services-branch-scope"
            >
              <option value={TENANT_DEFAULT_SCOPE}>{t('clinicalCatalog.scope.tenantDefault')}</option>
              {(branchesQuery.data ?? [])
                .filter((b) => b.isActive)
                .map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
            </select>
            <small>
              {t('clinicalCatalog.scope.current')}: {scopeLabel}
            </small>
          </label>
          <label>
            {t('clinicalCatalog.search')}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('clinicalCatalog.searchPlaceholder')}
              data-testid="clinical-services-search"
              aria-label={t('clinicalCatalog.search')}
              dir="auto"
            />
            <small>{t('clinicalCatalog.searchHint')}</small>
          </label>
          {canCreate ? (
            <AuthButton variant="secondary" onClick={() => setShowCreate((v) => !v)}>
              {t('clinicalCatalog.create')}
            </AuthButton>
          ) : null}
        </div>
      </section>

      {showCreate && canCreate ? (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('clinicalCatalog.create')}</h2>
          <form onSubmit={(e) => void submitCreate(e)}>
            <div className={styles.formGrid}>
              <label>
                {t('clinicalCatalog.stableKey')}
                <input value={keySuffix} onChange={(e) => setKeySuffix(e.target.value)} required />
                <small>{t('clinicalCatalog.stableKeyHint')}</small>
              </label>
              <label>
                {t('clinicalCatalog.nameEn')}
                <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} required />
              </label>
              <label>
                {t('clinicalCatalog.nameAr')}
                <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} required dir="rtl" />
              </label>
            </div>
            <AuthButton loading={createMutation.isPending} type="submit">
              {t('clinicalCatalog.save')}
            </AuthButton>
          </form>
        </section>
      ) : null}

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>{t('clinicalCatalog.title')}</h2>
        {servicesQuery.isLoading || servicesQuery.isFetching ? (
          <div className={styles.skeleton} aria-busy="true" />
        ) : servicesQuery.isError ? (
          <AuthAlert variant="error">{t('clinicalCatalog.loadError')}</AuthAlert>
        ) : items.length === 0 ? (
          <p className={styles.empty}>{t('clinicalCatalog.empty')}</p>
        ) : (
          <ul className={styles.recentList} data-testid="clinical-services-list">
            {items.map((service) => {
              const { config, inherited } = resolveConfigForScope(
                configsQuery.data,
                service.id,
                selectedBranchId,
              );
              const isCanonical = service.provenance === 'SYSTEM_CANONICAL';
              const enabledLabel = config
                ? config.enabled
                  ? t('clinicalCatalog.enable')
                  : t('clinicalCatalog.disable')
                : t('clinicalCatalog.notConfigured');
              const inheritanceLabel = inherited
                ? t('clinicalCatalog.scope.inherited')
                : selectedBranchId && config
                  ? t('clinicalCatalog.scope.override')
                  : t('clinicalCatalog.scope.tenantDefault');
              return (
                <li key={service.id} className={styles.recentItem}>
                  <span>
                    <strong>{tr(service, displayLocale)}</strong>
                    <span dir="ltr"> · {service.stableKey}</span>
                    <br />
                    <small>
                      {t(`clinicalCatalog.provenance.${service.provenance}` as 'clinicalCatalog.provenance.SYSTEM_CANONICAL')} · {service.lifecycle}
                      {isCanonical ? ` · ${enabledLabel} · ${inheritanceLabel}` : null}
                    </small>
                  </span>
                  <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {isCanonical && canUpdate ? (
                      <AuthButton
                        variant="secondary"
                        loading={configMutation.isPending}
                        onClick={() => void toggleEnabled(service, !(config?.enabled ?? false))}
                      >
                        {config?.enabled ? t('clinicalCatalog.disable') : t('clinicalCatalog.enable')}
                      </AuthButton>
                    ) : null}
                    {!isCanonical && canManage && service.lifecycle === 'DRAFT' ? (
                      <AuthButton
                        variant="secondary"
                        loading={publishMutation.isPending}
                        onClick={() => void publishMutation.mutateAsync(service.id)}
                      >
                        {t('clinicalCatalog.publish')}
                      </AuthButton>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
