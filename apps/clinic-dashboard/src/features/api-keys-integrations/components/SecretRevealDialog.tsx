import { useState } from 'react';
import { Modal } from '@/features/patients/components/Modal';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { useI18n } from '@booking/i18n/react';
import styles from '../api-integrations-layout.module.css';

/**
 * One-time secret reveal — never persisted in React Query cache by callers.
 */
export function SecretRevealDialog({
  open,
  title,
  secret,
  onClose,
}: {
  open: boolean;
  title: string;
  secret: string | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <div className={styles.actions}>
          <AuthButton variant="secondary" onClick={copy} disabled={!secret}>
            {copied
              ? t('apiIntegrations.secret.copied', 'Copied')
              : t('apiIntegrations.secret.copy', 'Copy once')}
          </AuthButton>
          <AuthButton variant="primary" onClick={onClose}>
            {t('apiIntegrations.secret.done', 'I saved it')}
          </AuthButton>
        </div>
      }
    >
      <p className={styles.muted} role="alert">
        {t(
          'apiIntegrations.secret.warning',
          'This secret is shown once. It will not appear again. Store it securely.',
        )}
      </p>
      {secret ? (
        <pre className={styles.secretBox} aria-label="One-time secret">
          {secret}
        </pre>
      ) : (
        <p className={styles.muted}>No secret to display.</p>
      )}
    </Modal>
  );
}
