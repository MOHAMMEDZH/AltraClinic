import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import type { UserSummary } from '../api/identity-api';
import { UserAvatar } from './UserAvatar';
import styles from '../user-management-layout.module.css';

export type DirectoryView = 'table' | 'grid' | 'cards';

function statusKey(user: UserSummary) {
  if (user.isLocked) return 'locked';
  if (!user.isActive) return 'inactive';
  return 'active';
}

interface Props {
  users: UserSummary[];
  view: DirectoryView;
  selected: Set<string>;
  canManage: boolean;
  branchName: (id: string | null) => string;
  onToggle: (id: string) => void;
}

export function UserDirectoryViews({ users, view, selected, canManage, branchName, onToggle }: Props) {
  const { t, locale } = useI18n();

  if (view === 'grid') {
    return (
      <div className={styles.cardGrid}>
        {users.map((row) => (
          <article key={row.id} className={styles.userCard}>
            {canManage && (
              <input
                type="checkbox"
                className={styles.cardCheckbox}
                checked={selected.has(row.id)}
                aria-label={row.fullName}
                onChange={() => onToggle(row.id)}
              />
            )}
            <UserAvatar name={row.fullName} avatarUrl={row.avatarUrl} size={48} />
            <Link className={styles.rowLink} to={`/settings/users/${row.id}`}>
              {row.fullName}
            </Link>
            <p className={styles.fieldLabel}>{row.email}</p>
            <p className={styles.fieldValue}>{branchName(row.branchId)}</p>
            <span className={[styles.badge, styles.badgeActive].join(' ')}>
              {t(`users.status.${statusKey(row)}`)}
            </span>
          </article>
        ))}
      </div>
    );
  }

  if (view === 'cards') {
    return (
      <ul className={styles.cardList}>
        {users.map((row) => (
          <li key={row.id} className={styles.cardRow}>
            {canManage && (
              <input type="checkbox" checked={selected.has(row.id)} aria-label={row.fullName} onChange={() => onToggle(row.id)} />
            )}
            <UserAvatar name={row.fullName} avatarUrl={row.avatarUrl} />
            <div className={styles.cardBody}>
              <Link className={styles.rowLink} to={`/settings/users/${row.id}`}>
                {row.fullName}
              </Link>
              <p className={styles.fieldLabel}>{row.email}</p>
              <ul className={styles.roleList}>
                {row.roles.map((r) => (
                  <li key={r} className={styles.roleChip}>
                    {t(`users.roleLabels.${r}` as 'users.title')}
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.cardMeta}>
              <span className={styles.badge}>{t(`users.status.${statusKey(row)}`)}</span>
              <span className={styles.fieldLabel}>
                {row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleDateString(locale) : t('users.detail.never')}
              </span>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return null;
}
