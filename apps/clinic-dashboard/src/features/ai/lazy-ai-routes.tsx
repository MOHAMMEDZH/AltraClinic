import { lazy, Suspense } from 'react';
import { AiLayout } from './components/AiLayout';

const AiHomePage = lazy(() => import('./AiHomePage').then((m) => ({ default: m.AiHomePage })));
const AiChatPage = lazy(() => import('./AiChatPage').then((m) => ({ default: m.AiChatPage })));
const AiWorkspacePage = lazy(() => import('./AiWorkspacePage').then((m) => ({ default: m.AiWorkspacePage })));
const AiPromptsPage = lazy(() => import('./AiPromptsPage').then((m) => ({ default: m.AiPromptsPage })));
const AiHistoryPage = lazy(() => import('./AiHistoryPage').then((m) => ({ default: m.AiHistoryPage })));
const AiSettingsPage = lazy(() => import('./AiSettingsPage').then((m) => ({ default: m.AiSettingsPage })));
const AiAdminPage = lazy(() => import('./AiAdminPage').then((m) => ({ default: m.AiAdminPage })));

function AiFallback() {
  return (
    <div style={{ padding: 'var(--space-6)' }} role="status" aria-busy="true" aria-label="Loading AI workspace">
      …
    </div>
  );
}

export function LazyAiLayout() {
  return (
    <Suspense fallback={<AiFallback />}>
      <AiLayout />
    </Suspense>
  );
}

export function LazyAiHomePage() {
  return (
    <Suspense fallback={<AiFallback />}>
      <AiHomePage />
    </Suspense>
  );
}

export function LazyAiChatPage() {
  return (
    <Suspense fallback={<AiFallback />}>
      <AiChatPage />
    </Suspense>
  );
}

export function LazyAiWorkspacePage() {
  return (
    <Suspense fallback={<AiFallback />}>
      <AiWorkspacePage />
    </Suspense>
  );
}

export function LazyAiPromptsPage() {
  return (
    <Suspense fallback={<AiFallback />}>
      <AiPromptsPage />
    </Suspense>
  );
}

export function LazyAiHistoryPage() {
  return (
    <Suspense fallback={<AiFallback />}>
      <AiHistoryPage />
    </Suspense>
  );
}

export function LazyAiSettingsPage() {
  return (
    <Suspense fallback={<AiFallback />}>
      <AiSettingsPage />
    </Suspense>
  );
}

export function LazyAiAdminPage() {
  return (
    <Suspense fallback={<AiFallback />}>
      <AiAdminPage />
    </Suspense>
  );
}
