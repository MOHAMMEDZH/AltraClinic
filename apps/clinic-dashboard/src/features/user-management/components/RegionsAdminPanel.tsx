import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { useCreateRegion, useRegions } from '../hooks/useUserEnterprise';
import styles from '../user-management-layout.module.css';

export function RegionsAdminPanel({ canManage }: { canManage: boolean }) {
  const { t, locale } = useI18n();
  const { data: regions = [] } = useRegions(true);
  const createRegion = useCreateRegion();
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');

  if (!canManage) return null;

  return (
    <section className={styles.panel} aria-labelledby="regions-admin-title">
      <h3 id="regions-admin-title" className={styles.panelTitle}>
        {t('users.regions.title')}
      </h3>
      <p className={styles.fieldLabel}>{t('users.regions.subtitle')}</p>

      {regions.length > 0 && (
        <ul className={styles.roleList}>
          {regions.map((region) => (
            <li key={region.id} className={styles.kpi}>
              {locale.startsWith('ar') && region.nameAr ? region.nameAr : region.name}
            </li>
          ))}
        </ul>
      )}

      <div className={styles.formStack}>
        <AuthFormField label={t('users.regions.name')} name="regionName" value={name} onChange={(e) => setName(e.target.value)} />
        <AuthFormField label={t('users.regions.nameAr')} name="regionNameAr" value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" />
        <AuthButton
          loading={createRegion.isPending}
          disabled={!name.trim()}
          onClick={() =>
            void createRegion.mutateAsync({ name: name.trim(), nameAr: nameAr.trim() || undefined }).then(() => {
              setName('');
              setNameAr('');
            })
          }
        >
          {t('users.regions.create')}
        </AuthButton>
      </div>
    </section>
  );
}
