import { useI18n } from '@booking/i18n/react';

export function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useI18n();

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>{t(titleKey)}</h1>
      <p style={{ color: 'var(--color-text-secondary)' }}>{t('pages.placeholder')}</p>
    </section>
  );
}
