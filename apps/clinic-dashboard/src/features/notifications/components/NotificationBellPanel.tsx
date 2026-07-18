import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  useMarkAllNotificationsRead,
  useNotificationsList,
  useUnreadCount,
} from '../hooks/useNotifications';
import { useNotificationsRealtime } from '../hooks/useNotificationsRealtime';
import styles from '../notifications-layout.module.css';
import topNavStyles from '@/layouts/AppShell/TopNav.module.css';

export function NotificationBellPanel() {
  const { t, locale } = useI18n();
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useNotificationsRealtime();
  const unreadQuery = useUnreadCount(true, false);
  const recentQuery = useNotificationsList({ limit: 5, unreadOnly: false }, open);
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = unreadQuery.data?.count ?? 0;
  const items = recentQuery.data?.items ?? [];

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open, close]);

  const badgeLabel =
    unreadCount > 0
      ? t('notifications.bell.unreadCount').replace('{count}', String(unreadCount))
      : undefined;

  return (
    <div className={styles.bellWrap} ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={topNavStyles.iconBtn}
        aria-label={badgeLabel ? `${t('shell.notifications')}, ${badgeLabel}` : t('shell.notifications')}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={18} aria-hidden />
        {unreadCount > 0 && (
          <span className={styles.bellBadge} aria-hidden>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          className={styles.bellPanel}
          role="dialog"
          aria-label={t('notifications.bell.title')}
        >
          <div className={styles.bellPanelHeader}>
            <strong>{t('notifications.bell.title')}</strong>
            {unreadCount > 0 && (
              <AuthButton
                variant="ghost"
                loading={markAllRead.isPending}
                onClick={() => void markAllRead.mutateAsync(undefined).then(close)}
              >
                {t('notifications.bell.markAllRead')}
              </AuthButton>
            )}
          </div>

          {recentQuery.isLoading ? (
            <p className={styles.empty} aria-busy="true">
              …
            </p>
          ) : items.length === 0 ? (
            <p className={styles.empty}>{t('notifications.bell.empty')}</p>
          ) : (
            <ul className={styles.bellList}>
              {items.map((item) => (
                <li key={item.notificationId}>
                  <Link
                    to={`/settings/notifications/inbox/${item.notificationId}`}
                    className={[styles.bellItem, !item.readAt ? styles.bellItemUnread : ''].filter(Boolean).join(' ')}
                    onClick={close}
                  >
                    <span>{item.title}</span>
                    <span className={styles.timelineMeta}>
                      {new Date(item.createdAt).toLocaleString(locale)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Link to="/settings/notifications/inbox" className={styles.backLink} onClick={close}>
            {t('notifications.bell.viewInbox')}
          </Link>
        </div>
      )}
    </div>
  );
}
