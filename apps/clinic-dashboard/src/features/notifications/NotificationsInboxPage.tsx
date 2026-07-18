import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Search, Star } from 'lucide-react';
import { FixedSizeList, type ListChildComponentProps } from 'react-window';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import type { NotificationSummary } from './api/notifications-api';
import {
  buildNotificationsPermCheck,
  canViewNotifications,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
  type InboxTab,
} from './config/notifications-config';
import {
  useDeleteSavedNotificationFilter,
  useInfiniteNotificationsList,
  useSaveNotificationFilter,
  useSavedNotificationFilters,
  useUpdateNotificationFlags,
} from './hooks/useNotifications';
import { maxLoadedPages } from './lib/virtual-list-range';
import styles from './notifications-layout.module.css';

const ROW_HEIGHT = 52;
const INBOX_PAGE_SIZE = 50;
const INBOX_MAX_LOADED_PAGES = 500;

function statusBadgeClass(status: string) {
  if (status === 'failed') return styles.badgeFailed;
  if (status === 'delivered' || status === 'read' || status === 'sent') return styles.badgeDelivered;
  return styles.badgeQueued;
}

interface RowData {
  items: NotificationSummary[];
  t: (key: string) => string;
  locale: string;
  onStar: (id: string, starred: boolean) => void;
  onArchive: (id: string, archived: boolean) => void;
}

function InboxRow({ index, style, data }: ListChildComponentProps<RowData>) {
  const item = data.items[index];
  if (!item) return null;
  const channelKey = `notifications.channels_labels.${item.channel}` as const;

  return (
    <div
      style={style}
      className={[
        styles.inboxVirtualRow,
        !item.readAt ? styles.inboxVirtualRowUnread : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="row"
    >
      <span role="cell">
        <button
          type="button"
          className={[styles.iconBtn, item.isStarred ? styles.iconBtnActive : ''].filter(Boolean).join(' ')}
          aria-label={item.isStarred ? data.t('notifications.inbox.unstar') : data.t('notifications.inbox.star')}
          onClick={() => data.onStar(item.notificationId, !item.isStarred)}
        >
          <Star size={16} fill={item.isStarred ? 'currentColor' : 'none'} aria-hidden />
        </button>
      </span>
      <span role="cell">
        <Link className={styles.rowLink} to={`/settings/notifications/inbox/${item.notificationId}`}>
          {item.title}
        </Link>
      </span>
      <span role="cell">{data.t(channelKey)}</span>
      <span role="cell">
        <span className={[styles.badge, statusBadgeClass(item.status)].join(' ')}>
          {data.t(`notifications.status_labels.${item.status}` as const)}
        </span>
      </span>
      <span role="cell">{new Date(item.createdAt).toLocaleString(data.locale)}</span>
      <span role="cell">
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={item.isArchived ? data.t('notifications.inbox.unarchive') : data.t('notifications.inbox.archive')}
          onClick={() => data.onArchive(item.notificationId, !item.isArchived)}
        >
          <Archive size={16} aria-hidden />
        </button>
      </span>
    </div>
  );
}

export function NotificationsInboxPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const perm = useMemo(() => buildNotificationsPermCheck(user?.roles ?? []), [user?.roles]);
  const canView = canViewNotifications(perm);

  const [tab, setTab] = useState<InboxTab>('all');
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const [filterName, setFilterName] = useState('');

  const saveFilterMutation = useSaveNotificationFilter();
  const deleteFilterMutation = useDeleteSavedNotificationFilter();
  const { data: savedFilters = [] } = useSavedNotificationFilters(canView);

  const listParams = useMemo(
    () => ({
      limit: INBOX_PAGE_SIZE,
      search: search.trim() || undefined,
      channel: channel || undefined,
      status: status || undefined,
      unreadOnly: tab === 'unread',
      starredOnly: tab === 'starred',
      archivedOnly: tab === 'archived' ? true : tab === 'all' ? false : undefined,
    }),
    [tab, search, channel, status],
  );

  const listQuery = useInfiniteNotificationsList(listParams, canView);
  const flagsMutation = useUpdateNotificationFlags();

  const items = useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [listQuery.data],
  );
  const inboxLoadCapReached = maxLoadedPages(items.length, INBOX_PAGE_SIZE, INBOX_MAX_LOADED_PAGES);

  const rowData = useMemo<RowData>(
    () => ({
      items,
      t,
      locale,
      onStar: (id, starred) => void flagsMutation.mutate({ notificationId: id, flags: { isStarred: starred } }),
      onArchive: (id, archived) => void flagsMutation.mutate({ notificationId: id, flags: { isArchived: archived } }),
    }),
    [items, t, locale, flagsMutation],
  );

  const currentFilterSnapshot = () => ({
    tab,
    search: search.trim(),
    channel,
    status,
  });

  const loadSavedFilter = (filters: Record<string, unknown>) => {
    if (typeof filters.tab === 'string') setTab(filters.tab as InboxTab);
    if (typeof filters.search === 'string') setSearch(filters.search);
    if (typeof filters.channel === 'string') setChannel(filters.channel);
    if (typeof filters.status === 'string') setStatus(filters.status);
  };

  if (!canView) {
    return <AuthAlert variant="error">{t('notifications.accessDenied')}</AuthAlert>;
  }

  return (
    <div className={styles.content}>
      {listQuery.isError && <AuthAlert variant="error">{t('notifications.loadError')}</AuthAlert>}

      <section className={styles.panel} aria-labelledby="inbox-title">
        <h2 id="inbox-title" className={styles.panelTitle}>
          {t('notifications.inbox.title')}
        </h2>

        <div className={styles.tabList} role="tablist" aria-label={t('notifications.inbox.title')}>
          {(
            [
              ['all', 'notifications.inbox.tabAll'],
              ['unread', 'notifications.inbox.tabUnread'],
              ['starred', 'notifications.inbox.tabStarred'],
              ['archived', 'notifications.inbox.tabArchived'],
            ] as const
          ).map(([key, labelKey]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={[styles.tab, tab === key ? styles.tabActive : ''].filter(Boolean).join(' ')}
              onClick={() => setTab(key)}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>

        <div className={styles.toolbar}>
          <div className={styles.filters}>
            <label className={styles.field}>
              <span className="sr-only">{t('notifications.inbox.search')}</span>
              <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <Search size={16} aria-hidden style={{ position: 'absolute', insetInlineStart: 8 }} />
                <input
                  className={styles.input}
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('notifications.inbox.searchPlaceholder')}
                  aria-label={t('notifications.inbox.search')}
                  style={{ paddingInlineStart: 32 }}
                />
              </span>
            </label>
            <select
              className={styles.select}
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              aria-label={t('notifications.inbox.channel')}
            >
              <option value="">{t('notifications.inbox.allChannels')}</option>
              {NOTIFICATION_CHANNELS.map((ch) => (
                <option key={ch} value={ch}>
                  {t(`notifications.channels_labels.${ch}`)}
                </option>
              ))}
            </select>
            <select
              className={styles.select}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label={t('notifications.inbox.status')}
            >
              <option value="">{t('notifications.inbox.allStatuses')}</option>
              {NOTIFICATION_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {t(`notifications.status_labels.${st}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.savedFiltersRow}>
          <AuthFormField
            label={t('notifications.inbox.filterName')}
            id="inbox-filter-name"
          >
            <input
              id="inbox-filter-name"
              className={styles.input}
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
            />
          </AuthFormField>
          <AuthButton
            variant="secondary"
            disabled={!filterName.trim()}
            loading={saveFilterMutation.isPending}
            onClick={() =>
              void saveFilterMutation
                .mutateAsync({ name: filterName.trim(), filters: currentFilterSnapshot() })
                .then(() => setFilterName(''))
            }
          >
            {t('notifications.inbox.saveFilter')}
          </AuthButton>
          {savedFilters.length > 0 && (
            <span className={styles.fieldLabel}>{t('notifications.inbox.savedFilters')}:</span>
          )}
          {savedFilters.map((sf) => (
            <span key={sf.id} className={styles.savedFiltersRow}>
              <AuthButton variant="secondary" onClick={() => loadSavedFilter(sf.filters)}>
                {t('notifications.inbox.loadFilter')}: {sf.name}
              </AuthButton>
              <AuthButton
                variant="secondary"
                loading={deleteFilterMutation.isPending}
                onClick={() => void deleteFilterMutation.mutateAsync(sf.id)}
              >
                {t('notifications.inbox.deleteFilter')}
              </AuthButton>
            </span>
          ))}
        </div>

        {listQuery.isLoading ? (
          <p className={styles.empty} aria-busy="true">
            …
          </p>
        ) : items.length === 0 ? (
          <p className={styles.empty}>{t('notifications.inbox.empty')}</p>
        ) : (
          <div className={styles.virtualTableWrap} role="region" aria-label={t('notifications.inbox.title')}>
            <div className={styles.inboxVirtualHeader} role="row">
              <span role="columnheader" aria-hidden />
              <span role="columnheader">{t('notifications.inbox.columnTitle')}</span>
              <span role="columnheader">{t('notifications.inbox.columnChannel')}</span>
              <span role="columnheader">{t('notifications.inbox.columnStatus')}</span>
              <span role="columnheader">{t('notifications.inbox.columnCreated')}</span>
              <span role="columnheader">{t('notifications.inbox.columnActions')}</span>
            </div>
            <FixedSizeList
              height={Math.min(480, items.length * ROW_HEIGHT + 8)}
              itemCount={items.length}
              itemSize={ROW_HEIGHT}
              width="100%"
              itemData={rowData}
            >
              {InboxRow}
            </FixedSizeList>
          </div>
        )}

        {listQuery.hasNextPage && !inboxLoadCapReached && (
          <div className={styles.pagination}>
            <AuthButton
              variant="secondary"
              loading={listQuery.isFetchingNextPage}
              loadingLabel={t('notifications.inbox.loadingMore')}
              onClick={() => void listQuery.fetchNextPage()}
            >
              {t('notifications.inbox.loadMore')}
            </AuthButton>
          </div>
        )}
        {inboxLoadCapReached && listQuery.hasNextPage && (
          <p className={styles.empty}>{t('notifications.inbox.loadCapHint')}</p>
        )}
      </section>
    </div>
  );
}
