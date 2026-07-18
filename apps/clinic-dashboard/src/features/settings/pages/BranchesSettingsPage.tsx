import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { Modal } from '@/features/patients/components/Modal';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { SettingsConfirmDialog } from '../components/SettingsConfirmDialog';
import {
  useArchiveBranch,
  useCreateBranch,
  useSettingsBranches,
  useUpdateBranch,
} from '../hooks/useSettings';
import { BranchHoursSettingsSection } from '../components/BranchHoursSettingsSection';
import type { BranchRecord } from '../api/settings-api';
import styles from '../settings-layout.module.css';

const EMPTY = { name: '', nameAr: '', city: '', phone: '', address: '' };

export function BranchesSettingsPage() {
  const { t } = useI18n();
  const branches = useSettingsBranches();
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const archiveBranch = useArchiveBranch();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BranchRecord | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [archiveTarget, setArchiveTarget] = useState<BranchRecord | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  }

  function openEdit(branch: BranchRecord) {
    setEditing(branch);
    setForm({
      name: branch.name,
      nameAr: branch.nameAr ?? '',
      city: branch.city ?? '',
      phone: branch.phone ?? '',
      address: branch.address ?? '',
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (editing) {
      updateBranch.mutate(
        { branchId: editing.id, body: form },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      createBranch.mutate(form, { onSuccess: () => setDialogOpen(false) });
    }
  }

  if (branches.isLoading) {
    return <div className={styles.skeleton} role="status" aria-busy="true" aria-label={t('settings.loading')} />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('settings.branches.title')}</h2>
          <p className={styles.pageSubtitle}>{t('settings.branches.subtitle')}</p>
        </div>
        <div className={styles.actions}>
          <Link className={styles.navLink} to="/settings/users">
            {t('settings.branches.manageUsers')}
          </Link>
          <AuthButton onClick={openCreate}>{t('settings.branches.create')}</AuthButton>
        </div>
      </header>

      <section className={styles.panel}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('settings.branches.name')}</th>
                <th>{t('settings.branches.city')}</th>
                <th>{t('settings.branches.status')}</th>
                <th>{t('settings.branches.phone')}</th>
                <th>{t('settings.branches.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {(branches.data ?? []).map((branch) => (
                <tr key={branch.id}>
                  <td>{branch.name}</td>
                  <td>{branch.city ?? '—'}</td>
                  <td>{branch.isActive ? t('settings.branches.active') : t('settings.branches.inactive')}</td>
                  <td dir="ltr">{branch.phone ?? '—'}</td>
                  <td>
                    <div className={styles.actions}>
                      <AuthButton variant="ghost" onClick={() => openEdit(branch)}>
                        {t('settings.branches.edit')}
                      </AuthButton>
                      {branch.isActive && (
                        <AuthButton variant="danger" onClick={() => setArchiveTarget(branch)}>
                          {t('settings.branches.archive')}
                        </AuthButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!branches.data?.length && <p className={styles.empty}>{t('settings.branches.empty')}</p>}
      </section>

      <Modal
        open={dialogOpen}
        title={editing ? t('settings.branches.editTitle') : t('settings.branches.createTitle')}
        onClose={() => setDialogOpen(false)}
        footer={
          <div className={styles.actions}>
            <AuthButton variant="secondary" onClick={() => setDialogOpen(false)}>
              {t('settings.actions.cancel')}
            </AuthButton>
            <AuthButton loading={createBranch.isPending || updateBranch.isPending} onClick={handleSave}>
              {t('settings.actions.save')}
            </AuthButton>
          </div>
        }
      >
        <AuthFormField id="branch-name" label={t('settings.branches.name')} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        <AuthFormField id="branch-name-ar" label={t('settings.branches.nameAr')} value={form.nameAr} onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))} />
        <AuthFormField id="branch-city" label={t('settings.branches.city')} value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
        <AuthFormField id="branch-phone" label={t('settings.branches.phone')} value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} dir="ltr" />
        <AuthFormField id="branch-address" label={t('settings.branches.address')} value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
        {(createBranch.isError || updateBranch.isError) && (
          <AuthAlert variant="error">{t('settings.saveError')}</AuthAlert>
        )}
      </Modal>

      <SettingsConfirmDialog
        open={Boolean(archiveTarget)}
        title={t('settings.branches.archiveTitle')}
        message={t('settings.branches.archiveConfirm')}
        destructive
        loading={archiveBranch.isPending}
        confirmLabel={t('settings.branches.archive')}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => {
          if (!archiveTarget) return;
          archiveBranch.mutate(archiveTarget.id, { onSuccess: () => setArchiveTarget(null) });
        }}
      />

      {(branches.data?.length ?? 0) > 0 && <BranchHoursSettingsSection branches={branches.data ?? []} />}
    </div>
  );
}
