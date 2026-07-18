import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { useDashboardBranches } from '@/features/dashboard/hooks/useDashboardBranches';
import {
  assignableRoles,
  buildIdentityPermCheck,
  canCreateUsers,
} from './config/user-management-config';
import { useInviteStaffUser } from './hooks/useUserManagement';
import styles from './user-management-layout.module.css';

export function InviteUserPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const perm = useMemo(() => buildIdentityPermCheck(user?.roles ?? []), [user?.roles]);
  const canCreate = canCreateUsers(perm);
  const inviteMutation = useInviteStaffUser();
  const { data: branches = [] } = useDashboardBranches();

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [branchId, setBranchId] = useState('');
  const [roles, setRoles] = useState<string[]>(['receptionist']);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!canCreate) {
    return <AuthAlert variant="error">{t('users.accessDenied')}</AuthAlert>;
  }

  function toggleRole(role: string) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  function branchLabel(id: string) {
    const branch = branches.find((b) => b.id === id);
    if (!branch) return id;
    return locale.startsWith('ar') && branch.nameAr ? branch.nameAr : branch.name;
  }

  return (
    <section className={styles.panel} aria-labelledby="invite-user-title">
      <h2 id="invite-user-title" className={styles.panelTitle}>
        {t('users.invite.title')}
      </h2>
      <p className={styles.fieldLabel}>{t('users.invite.subtitleInvite')}</p>

      <form
        className={styles.formStack}
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setSuccess(false);
          void inviteMutation
            .mutateAsync({
              email,
              firstName,
              lastName,
              phone: phone || undefined,
              branchId: branchId || undefined,
              roles,
            })
            .then((result) => {
              setSuccess(true);
              navigate(`/settings/users/${result.user.id}`);
            })
            .catch((err: Error) => setError(err.message));
        }}
      >
        <AuthFormField label={t('users.invite.email')} name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <AuthFormField label={t('users.invite.firstName')} name="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        <AuthFormField label={t('users.invite.lastName')} name="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        <AuthFormField label={t('users.invite.phone')} name="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('users.detail.branch')}</span>
          <select
            className={styles.select}
            value={branchId}
            aria-label={t('users.detail.branch')}
            onChange={(e) => setBranchId(e.target.value)}
          >
            <option value="">{t('users.detail.unassigned')}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {locale.startsWith('ar') && b.nameAr ? b.nameAr : b.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className={styles.fieldLabel}>{t('users.invite.roles')}</legend>
          <div className={styles.checkboxGrid}>
            {assignableRoles().map((role) => (
              <label key={role} className={styles.checkboxLabel}>
                <input type="checkbox" checked={roles.includes(role)} onChange={() => toggleRole(role)} />
                {t(`users.roleLabels.${role}` as 'users.title')}
              </label>
            ))}
          </div>
        </fieldset>

        {branchId && (
          <p className={styles.fieldLabel}>{t('users.invite.branchHint').replace('{branch}', branchLabel(branchId))}</p>
        )}

        {error && <AuthAlert variant="error">{error}</AuthAlert>}
        {success && <AuthAlert variant="success">{t('users.invite.successInvite')}</AuthAlert>}

        <AuthButton type="submit" loading={inviteMutation.isPending} disabled={roles.length === 0}>
          {t('users.invite.submitInvite')}
        </AuthButton>
      </form>
    </section>
  );
}
