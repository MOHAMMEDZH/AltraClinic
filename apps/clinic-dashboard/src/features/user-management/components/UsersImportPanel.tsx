import { useRef, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { useImportUsers, useImportUsersXlsx } from '../hooks/useUserEnterprise';
import styles from '../user-management-layout.module.css';

function parseCsv(text: string): Array<{ email: string; firstName: string; lastName: string; roles?: string[] }> {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const emailIdx = header.indexOf('email');
  const firstIdx = header.findIndex((h) => h === 'firstname' || h === 'first_name' || h === 'first name');
  const lastIdx = header.findIndex((h) => h === 'lastname' || h === 'last_name' || h === 'last name');
  const rolesIdx = header.indexOf('roles');
  if (emailIdx < 0 || firstIdx < 0 || lastIdx < 0) return [];

  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    return {
      email: cols[emailIdx] ?? '',
      firstName: cols[firstIdx] ?? '',
      lastName: cols[lastIdx] ?? '',
      roles: rolesIdx >= 0 && cols[rolesIdx] ? cols[rolesIdx].split(';').map((r) => r.trim()) : undefined,
    };
  });
}

type ImportResult = { created: number; errors: Array<{ row: number; message: string }> };

export function UsersImportPanel() {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const importMutation = useImportUsers();
  const importXlsxMutation = useImportUsersXlsx();
  const [preview, setPreview] = useState<ReturnType<typeof parseCsv>>([]);
  const [pendingXlsx, setPendingXlsx] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleFile(file: File) {
    setResult(null);
    const isXlsx = file.name.toLowerCase().endsWith('.xlsx');
    if (isXlsx) {
      setPendingXlsx(file);
      setPreview([]);
      return;
    }
    setPendingXlsx(null);
    void file.text().then((text) => setPreview(parseCsv(text)));
  }

  return (
    <section className={styles.panel} aria-labelledby="users-import-title">
      <h2 id="users-import-title" className={styles.panelTitle}>
        {t('users.import.title')}
      </h2>
      <p className={styles.fieldLabel}>{t('users.import.subtitle')}</p>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="visually-hidden"
        aria-label={t('users.import.chooseFile')}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      <div className={styles.actions}>
        <AuthButton variant="secondary" onClick={() => fileRef.current?.click()}>
          {t('users.import.chooseFile')}
        </AuthButton>
        {preview.length > 0 && (
          <AuthButton
            loading={importMutation.isPending}
            onClick={() =>
              void importMutation.mutateAsync(preview).then((r) => {
                setResult(r);
                setPreview([]);
              })
            }
          >
            {t('users.import.importRows').replace('{count}', String(preview.length))}
          </AuthButton>
        )}
        {pendingXlsx && (
          <AuthButton
            loading={importXlsxMutation.isPending}
            onClick={() =>
              void importXlsxMutation.mutateAsync(pendingXlsx).then((r) => {
                setResult(r);
                setPendingXlsx(null);
              })
            }
          >
            {t('users.import.importXlsx').replace('{name}', pendingXlsx.name)}
          </AuthButton>
        )}
      </div>

      {preview.length > 0 && (
        <p className={styles.fieldLabel}>
          {t('users.import.preview').replace('{count}', String(preview.length))}
        </p>
      )}

      {pendingXlsx && (
        <p className={styles.fieldLabel}>
          {t('users.import.xlsxReady').replace('{name}', pendingXlsx.name)}
        </p>
      )}

      {result && (
        <AuthAlert variant={result.errors.length ? 'warning' : 'success'}>
          {t('users.import.result')
            .replace('{created}', String(result.created))
            .replace('{errors}', String(result.errors.length))}
        </AuthAlert>
      )}

      {result?.errors.length ? (
        <ul className={styles.roleList} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          {result.errors.map((err) => (
            <li key={err.row} className={styles.kpi}>
              Row {err.row}: {err.message}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
