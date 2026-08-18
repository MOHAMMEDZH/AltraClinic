import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { canViewUsers, buildIdentityPermCheck } from '@/features/user-management/config/user-management-config';
import { useUsers } from '@/features/user-management/hooks/useUserManagement';
import { mergeAccountableStaffOptions, staffOptionLabel } from '../utils/accountable-staff-options';

interface AccountableStaffSelectProps {
  value: string;
  onChange: (usedByUserId: string) => void;
  error?: string | null;
  id?: string;
}

export function AccountableStaffSelect({ value, onChange, error, id = 'stock-request-used-by' }: AccountableStaffSelectProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const canListStaff = canViewUsers(buildIdentityPermCheck(user?.roles ?? []));
  const usersQuery = useUsers({ status: 'active', limit: 200 }, canListStaff);

  const options = mergeAccountableStaffOptions({
    currentUser: user?.userId
      ? {
          id: user.userId,
          label: staffOptionLabel({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
          }),
        }
      : null,
    directoryUsers: usersQuery.data?.items ?? [],
  });

  return (
    <AuthFormField
      id={id}
      label={t('inventory.stockRequests.accountableStaff')}
      helpText={t('inventory.stockRequests.accountableStaffHelp')}
      error={error}
    >
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        aria-required="true"
      >
        <option value="">{t('inventory.stockRequests.accountableStaffPlaceholder')}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </AuthFormField>
  );
}
