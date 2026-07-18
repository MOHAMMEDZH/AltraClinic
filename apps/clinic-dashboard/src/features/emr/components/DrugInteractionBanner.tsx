import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { useI18n } from '@booking/i18n/react';

export interface DrugWarning {
  id: string;
  severity: string;
  type: string;
  message: string;
  source?: string;
}

interface DrugInteractionBannerProps {
  warnings: DrugWarning[];
  externalChecked?: boolean;
}

export function DrugInteractionBanner({ warnings, externalChecked }: DrugInteractionBannerProps) {
  const { t } = useI18n();
  if (!warnings.length) return null;

  return (
    <AuthAlert variant="error">
      <strong>{t('emr.safety.drugInteraction')}</strong>
      {externalChecked && <p className="sr-only">{t('emr.safety.externalChecked')}</p>}
      <ul>
        {warnings.map((w) => (
          <li key={w.id}>
            {w.message}
            {w.source ? ` (${w.source})` : ''}
          </li>
        ))}
      </ul>
    </AuthAlert>
  );
}
