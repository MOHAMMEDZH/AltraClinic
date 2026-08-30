import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FixedSizeList, type ListChildComponentProps } from 'react-window';
import { useI18n } from '@booking/i18n/react';
import type { UserSummary } from '../api/identity-api';
import { UserAvatar } from './UserAvatar';
import styles from '../user-management-layout.module.css';

const ROW_HEIGHT = 52;

export interface VirtualizedUsersTableProps {
  users: UserSummary[];
  selected: Set<string>;
  canManage: boolean;
  allPageSelected: boolean;
  branchName: (id: string | null) => string;
  onToggle: (id: string) => void;
  onTogglePage: () => void;
  height?: number;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

function userStatus(user: { isActive: boolean; isLocked: boolean }) {
  if (user.isLocked) return 'locked';
  if (!user.isActive) return 'inactive';
  return 'active';
}

export function VirtualizedUsersTable({
  users,
  selected,
  canManage,
  allPageSelected,
  branchName,
  onToggle,
  onTogglePage,
  height = 480,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: VirtualizedUsersTableProps) {
  const { t, locale } = useI18n();

  const itemData = useMemo(
    () => ({ users, selected, canManage, branchName, onToggle, t, locale }),
    [users, selected, canManage, branchName, onToggle, t, locale],
  );

  return (
    <div className={styles.virtualTableWrap} role="region" aria-label={t('users.directory.title')}>
      <div className={styles.virtualTableHeader} role="row">
        {canManage && (
          <span role="columnheader">
            <input
              type="checkbox"
              aria-label={t('users.directory.selectAll')}
              checked={allPageSelected}
              onChange={onTogglePage}
            />
          </span>
        )}
        <span role="columnheader">{t('users.directory.name')}</span>
        <span role="columnheader">{t('users.directory.email')}</span>
        <span role="columnheader">{t('users.directory.roles')}</span>
        <span role="columnheader">{t('users.directory.branch')}</span>
        <span role="columnheader">{t('users.directory.statusCol')}</span>
        <span role="columnheader">{t('users.directory.lastLogin')}</span>
        <span role="columnheader">{t('users.directory.actions')}</span>
      </div>
      {users.length === 0 ? (
        <p className={styles.empty}>{t('users.directory.empty')}</p>
      ) : (
        <>
          <FixedSizeList
            height={Math.min(height, users.length * ROW_HEIGHT + 8)}
            itemCount={users.length}
            itemSize={ROW_HEIGHT}
            width="100%"
            itemData={itemData}
            onItemsRendered={({ visibleStopIndex }) => {
              if (hasMore && !loadingMore && onLoadMore && visibleStopIndex >= users.length - 5) {
                onLoadMore();
              }
            }}
          >
            {UserRow}
          </FixedSizeList>
          {hasMore && (
            <div className={styles.actions} style={{ marginTop: 'var(--space-3)' }}>
              <button
                type="button"
                className={styles.tab}
                disabled={loadingMore}
                onClick={() => onLoadMore?.()}
              >
                {loadingMore ? t('users.directory.loadingMore') : t('users.directory.loadMore')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function UserRow({
  index,
  style,
  data,
}: ListChildComponentProps<{
  users: UserSummary[];
  selected: Set<string>;
  canManage: boolean;
  branchName: (id: string | null) => string;
  onToggle: (id: string) => void;
  t: (key: string) => string;
  locale: string;
}>) {
  const row = data.users[index];
  const statusKey = userStatus(row);

  return (
    <div style={style} className={styles.virtualTableRow} role="row">
      {data.canManage && (
        <span role="cell">
          <input
            type="checkbox"
            aria-label={row.fullName}
            checked={data.selected.has(row.id)}
            onChange={() => data.onToggle(row.id)}
          />
        </span>
      )}
      <span role="cell">
        <Link className={styles.rowLink} to={`/settings/users/${row.id}`}>
          <span className={styles.nameCell}>
            <UserAvatar name={row.fullName} avatarUrl={row.avatarUrl} size={28} />
            {row.fullName}
          </span>
        </Link>
      </span>
      <span role="cell">{row.email}</span>
      <span role="cell">
        {row.roles.map((r) => data.t(`users.roleLabels.${r}` as 'users.title')).join(', ')}
      </span>
      <span role="cell">{data.branchName(row.branchId)}</span>
      <span role="cell">{data.t(`users.status.${statusKey}`)}</span>
      <span role="cell">
        {row.lastLoginAt
          ? new Date(row.lastLoginAt).toLocaleString(data.locale)
          : data.t('users.detail.never')}
      </span>
      <span role="cell">
        <Link className={styles.rowLink} to={`/settings/users/${row.id}`}>
          {data.t('users.directory.view')}
        </Link>
      </span>
    </div>
  );
}
