import { lazy, Suspense } from 'react';
import { UserManagementLayout } from './components/UserManagementLayout';

const UsersHomePage = lazy(() => import('./UsersHomePage').then((m) => ({ default: m.UsersHomePage })));
const UsersDirectoryPage = lazy(() => import('./UsersDirectoryPage').then((m) => ({ default: m.UsersDirectoryPage })));
const UserDetailPage = lazy(() => import('./UserDetailPage').then((m) => ({ default: m.UserDetailPage })));
const InviteUserPage = lazy(() => import('./InviteUserPage').then((m) => ({ default: m.InviteUserPage })));
const CreateUserWizardPage = lazy(() => import('./CreateUserWizardPage').then((m) => ({ default: m.CreateUserWizardPage })));
const UsersAuditPage = lazy(() => import('./UsersAuditPage').then((m) => ({ default: m.UsersAuditPage })));
const RolesOverviewPage = lazy(() => import('./RolesOverviewPage').then((m) => ({ default: m.RolesOverviewPage })));
const UsersInvitationsPage = lazy(() => import('./UsersInvitationsPage').then((m) => ({ default: m.UsersInvitationsPage })));

function UserManagementFallback() {
  return <div style={{ padding: 'var(--space-6)' }} aria-busy="true" />;
}

export function LazyUserManagementLayout() {
  return (
    <Suspense fallback={<UserManagementFallback />}>
      <UserManagementLayout />
    </Suspense>
  );
}

export function LazyUsersHomePage() {
  return (
    <Suspense fallback={<UserManagementFallback />}>
      <UsersHomePage />
    </Suspense>
  );
}

export function LazyUsersDirectoryPage() {
  return (
    <Suspense fallback={<UserManagementFallback />}>
      <UsersDirectoryPage />
    </Suspense>
  );
}

export function LazyUserDetailPage() {
  return (
    <Suspense fallback={<UserManagementFallback />}>
      <UserDetailPage />
    </Suspense>
  );
}

export function LazyInviteUserPage() {
  return (
    <Suspense fallback={<UserManagementFallback />}>
      <InviteUserPage />
    </Suspense>
  );
}

export function LazyCreateUserWizardPage() {
  return (
    <Suspense fallback={<UserManagementFallback />}>
      <CreateUserWizardPage />
    </Suspense>
  );
}

export function LazyUsersAuditPage() {
  return (
    <Suspense fallback={<UserManagementFallback />}>
      <UsersAuditPage />
    </Suspense>
  );
}

export function LazyRolesOverviewPage() {
  return (
    <Suspense fallback={<UserManagementFallback />}>
      <RolesOverviewPage />
    </Suspense>
  );
}

export function LazyUsersInvitationsPage() {
  return (
    <Suspense fallback={<UserManagementFallback />}>
      <UsersInvitationsPage />
    </Suspense>
  );
}
