import { lazy, Suspense } from 'react';
import { NotificationsLayout } from './components/NotificationsLayout';

const NotificationsHomePage = lazy(() =>
  import('./NotificationsHomePage').then((m) => ({ default: m.NotificationsHomePage })),
);
const NotificationsInboxPage = lazy(() =>
  import('./NotificationsInboxPage').then((m) => ({ default: m.NotificationsInboxPage })),
);
const NotificationDetailPage = lazy(() =>
  import('./NotificationDetailPage').then((m) => ({ default: m.NotificationDetailPage })),
);
const NotificationComposerPage = lazy(() =>
  import('./NotificationComposerPage').then((m) => ({ default: m.NotificationComposerPage })),
);
const NotificationDraftsPage = lazy(() =>
  import('./NotificationDraftsPage').then((m) => ({ default: m.NotificationDraftsPage })),
);
const NotificationTemplatesPage = lazy(() =>
  import('./NotificationTemplatesPage').then((m) => ({ default: m.NotificationTemplatesPage })),
);
const NotificationAutomationPage = lazy(() =>
  import('./NotificationAutomationPage').then((m) => ({ default: m.NotificationAutomationPage })),
);
const NotificationDeliveryLogPage = lazy(() =>
  import('./NotificationDeliveryLogPage').then((m) => ({ default: m.NotificationDeliveryLogPage })),
);
const NotificationChannelsPage = lazy(() =>
  import('./NotificationChannelsPage').then((m) => ({ default: m.NotificationChannelsPage })),
);
const NotificationPreferencesPage = lazy(() =>
  import('./NotificationPreferencesPage').then((m) => ({ default: m.NotificationPreferencesPage })),
);

function NotificationsFallback() {
  return <div style={{ padding: 'var(--space-6)' }} aria-busy="true" />;
}

export function LazyNotificationsLayout() {
  return (
    <Suspense fallback={<NotificationsFallback />}>
      <NotificationsLayout />
    </Suspense>
  );
}

export function LazyNotificationsHomePage() {
  return (
    <Suspense fallback={<NotificationsFallback />}>
      <NotificationsHomePage />
    </Suspense>
  );
}

export function LazyNotificationsInboxPage() {
  return (
    <Suspense fallback={<NotificationsFallback />}>
      <NotificationsInboxPage />
    </Suspense>
  );
}

export function LazyNotificationDetailPage() {
  return (
    <Suspense fallback={<NotificationsFallback />}>
      <NotificationDetailPage />
    </Suspense>
  );
}

export function LazyNotificationComposerPage() {
  return (
    <Suspense fallback={<NotificationsFallback />}>
      <NotificationComposerPage />
    </Suspense>
  );
}

export function LazyNotificationDraftsPage() {
  return (
    <Suspense fallback={<NotificationsFallback />}>
      <NotificationDraftsPage />
    </Suspense>
  );
}

export function LazyNotificationTemplatesPage() {
  return (
    <Suspense fallback={<NotificationsFallback />}>
      <NotificationTemplatesPage />
    </Suspense>
  );
}

export function LazyNotificationAutomationPage() {
  return (
    <Suspense fallback={<NotificationsFallback />}>
      <NotificationAutomationPage />
    </Suspense>
  );
}

export function LazyNotificationDeliveryLogPage() {
  return (
    <Suspense fallback={<NotificationsFallback />}>
      <NotificationDeliveryLogPage />
    </Suspense>
  );
}

export function LazyNotificationChannelsPage() {
  return (
    <Suspense fallback={<NotificationsFallback />}>
      <NotificationChannelsPage />
    </Suspense>
  );
}

export function LazyNotificationPreferencesPage() {
  return (
    <Suspense fallback={<NotificationsFallback />}>
      <NotificationPreferencesPage />
    </Suspense>
  );
}
