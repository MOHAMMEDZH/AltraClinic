import { FormEvent, useMemo, useState } from 'react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import type { ClinicalCatalogService } from './api/clinical-catalog-api';
import {
  useClinicalServices,
  useCreateTenantClinicalService,
  usePublishClinicalService,
  useTenantServiceConfigs,
  useUpsertTenantServiceConfig,
} from './hooks/useClinicalCatalog';
import styles from '../billing/billing-layout.module.css';

function tr(service: ClinicalCatalogService, locale: string): string {
  return service.translations.find((t) => t.locale === locale)?.displayName ?? service.stableKey;
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

  const servicesQuery = useClinicalServices(canView);
  const configsQuery = useTenantServiceConfigs(canView);
  const createMutation = useCreateTenantClinicalService();
  const publishMutation = usePublishClinicalService();
  const configMutation = useUpsertTenantServiceConfig();

  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [keySuffix, setKeySuffix] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');

  const configByServiceId = useMemo(() => {
    const map = new Map<string, { enabled: boolean }>();
    for (const cfg of configsQuery.data ?? []) {
      if (cfg.branchId === null) {
        map.set(cfg.clinicalServiceId, { enabled: cfg.enabled });
      }
    }
    return map;
  }, [configsQuery.data]);

  const filtered = useMemo(() => {
    const items = servicesQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (s) =>
        s.stableKey.toLowerCase().includes(q) ||
        tr(s, 'en').toLowerCase().includes(q) ||
        tr(s, 'ar').toLowerCase().includes(q),
    );
  }, [servicesQuery.data, search]);

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
    await configMutation.mutateAsync({ clinicalServiceId: service.id, enabled });
  }

  const displayLocale = locale.startsWith('ar') ? 'ar' : 'en';

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
            {t('clinicalCatalog.search')}
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
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
        {servicesQuery.isLoading ? (
          <div className={styles.skeleton} aria-busy="true" />
        ) : servicesQuery.isError ? (
          <AuthAlert variant="error">{t('clinicalCatalog.loadError')}</AuthAlert>
        ) : filtered.length === 0 ? (
          <p className={styles.empty}>{t('clinicalCatalog.empty')}</p>
        ) : (
          <ul className={styles.recentList}>
            {filtered.map((service) => {
              const cfg = configByServiceId.get(service.id);
              const isCanonical = service.provenance === 'SYSTEM_CANONICAL';
              return (
                <li key={service.id} className={styles.recentItem}>
                  <span>
                    <strong>{tr(service, displayLocale)}</strong>
                    <span dir="ltr"> · {service.stableKey}</span>
                    <br />
                    <small>
                      {t(`clinicalCatalog.provenance.${service.provenance}` as 'clinicalCatalog.provenance.SYSTEM_CANONICAL')} · {service.lifecycle}
                      {isCanonical
                        ? ` · ${cfg ? (cfg.enabled ? t('clinicalCatalog.enable') : t('clinicalCatalog.disable')) : t('clinicalCatalog.notConfigured')}`
                        : null}
                    </small>
                  </span>
                  <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {isCanonical && canUpdate ? (
                      <AuthButton
                        variant="secondary"
                        loading={configMutation.isPending}
                        onClick={() => void toggleEnabled(service, !(cfg?.enabled ?? false))}
                      >
                        {cfg?.enabled ? t('clinicalCatalog.disable') : t('clinicalCatalog.enable')}
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
