import { useEffect, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { fetchSettingsStatus } from '../api/settings-api';
import styles from '../settings-layout.module.css';

export function MaintenanceBanner() {
  const { t } = useI18n();
  const { getValidAccessToken, user } = useAuth();
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user?.tenantId) return;
      try {
        const token = await getValidAccessToken();
        if (!token || cancelled) return;
        const status = await fetchSettingsStatus(token, user.tenantId);
        if (!cancelled) setMaintenance(Boolean(status.maintenanceMode));
      } catch {
        /* non-blocking */
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [getValidAccessToken, user?.tenantId]);

  if (!maintenance) return null;

  return (
    <div className={styles.maintenanceBanner} role="status">
      {t('settings.maintenance.banner')}
    </div>
  );
}
