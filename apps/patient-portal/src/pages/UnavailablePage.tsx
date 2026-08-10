import { usePortalI18n } from '../app/providers/LocalizationProvider';
import { usePortalConfig } from '../app/providers/ConfigProvider';

/** Disabled-state UX when PATIENT_PORTAL_CENTER_ENABLED is OFF. */
export function UnavailablePage() {
  const { t } = usePortalI18n();
  const { config } = usePortalConfig();

  return (
    <section className="portal-unavailable" aria-labelledby="unavailable-title">
      <h1 id="unavailable-title">{t('app.unavailable.title')}</h1>
      <p>{t('app.unavailable.body')}</p>
      <p className="portal-meta" data-testid="portal-phase">
        {config.phase} · flag OFF
      </p>
    </section>
  );
}
