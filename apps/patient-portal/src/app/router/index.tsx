import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { PortalShellLayout } from '../layout/PortalShellLayout';
import { UnavailablePage } from '../../pages/UnavailablePage';
import { FoundationPage } from '../../pages/FoundationPage';
import { HomeDashboardPage } from '../../pages/HomeDashboardPage';
import { LoginPage } from '../../pages/LoginPage';
import { EnrollPage } from '../../pages/EnrollPage';
import { MfaPage } from '../../pages/MfaPage';
import { AccountPage } from '../../pages/AccountPage';
import { AppointmentsPage } from '../../pages/AppointmentsPage';
import { AppointmentDetailPage } from '../../pages/AppointmentDetailPage';
import { BookAppointmentPage, RescheduleAppointmentPage } from '../../pages/BookAppointmentPage';
import { CaregiversPage, ProfilePage } from '../../pages/CaregiverPages';
import { usePortalConfig } from '../providers/ConfigProvider';
import {
  RequireAppointmentsEnabled,
  RequirePortalSession,
} from './RequirePortalSession';

function RequireCaregiverEnabled({ children }: { children: ReactNode }) {
  const { config } = usePortalConfig();
  if (!config.caregiverEnabled) {
    return <Navigate to="/account" replace />;
  }
  return <>{children}</>;
}

function CenterGate() {
  const { config, storage } = usePortalConfig();
  if (!config.centerEnabled) {
    return <UnavailablePage />;
  }
  if (storage.getItem('portal.accessToken')) {
    return <HomeDashboardPage />;
  }
  return <FoundationPage />;
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <PortalShellLayout />,
    children: [
      { index: true, element: <CenterGate /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'enroll', element: <EnrollPage /> },
      { path: 'mfa', element: <MfaPage /> },
      {
        path: 'account',
        element: (
          <RequirePortalSession>
            <AccountPage />
          </RequirePortalSession>
        ),
      },
      {
        path: 'appointments',
        element: (
          <RequirePortalSession>
            <RequireAppointmentsEnabled>
              <AppointmentsPage />
            </RequireAppointmentsEnabled>
          </RequirePortalSession>
        ),
      },
      {
        path: 'appointments/book',
        element: (
          <RequirePortalSession>
            <RequireAppointmentsEnabled>
              <BookAppointmentPage />
            </RequireAppointmentsEnabled>
          </RequirePortalSession>
        ),
      },
      {
        path: 'appointments/:appointmentId',
        element: (
          <RequirePortalSession>
            <RequireAppointmentsEnabled>
              <AppointmentDetailPage />
            </RequireAppointmentsEnabled>
          </RequirePortalSession>
        ),
      },
      {
        path: 'appointments/:appointmentId/reschedule',
        element: (
          <RequirePortalSession>
            <RequireAppointmentsEnabled>
              <RescheduleAppointmentPage />
            </RequireAppointmentsEnabled>
          </RequirePortalSession>
        ),
      },
      {
        path: 'profile',
        element: (
          <RequirePortalSession>
            <ProfilePage />
          </RequirePortalSession>
        ),
      },
      {
        path: 'caregivers',
        element: (
          <RequirePortalSession>
            <RequireCaregiverEnabled>
              <CaregiversPage />
            </RequireCaregiverEnabled>
          </RequirePortalSession>
        ),
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
