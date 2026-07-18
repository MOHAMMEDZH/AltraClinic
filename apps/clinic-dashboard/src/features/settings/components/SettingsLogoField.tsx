import { useRef, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { uploadMedia } from '@/features/media/api/media-api';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { AuthButton } from '@/features/auth/components/AuthButton';
import styles from '../settings-layout.module.css';

interface SettingsLogoFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (mediaId: string) => void;
  helpText?: string;
}

export function SettingsLogoField({ id, label, value, onChange, helpText }: SettingsLogoFieldProps) {
  const { t } = useI18n();
  const { getValidAccessToken, user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      const result = await uploadMedia(token, user.tenantId, {
        file,
        category: 'patient_attachment',
        ownerType: 'tenant',
        ownerId: user.tenantId,
        patientId: user.tenantId,
        title: 'Clinic logo',
      });
      onChange(result.mediaId);
    } catch {
      setError(t('settings.logo.uploadError'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={styles.logoField}>
      <AuthFormField
        id={id}
        label={label}
        helpText={helpText}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir="ltr"
      />
      <div className={styles.actions}>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className={styles.srOnly}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <AuthButton
          type="button"
          variant="secondary"
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {t('settings.logo.upload')}
        </AuthButton>
      </div>
      {error && <p className={styles.fieldError} role="alert">{error}</p>}
      {value && (
        <p className={styles.pageSubtitle}>
          {t('settings.logo.current')}: <code dir="ltr">{value}</code>
        </p>
      )}
    </div>
  );
}
