import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '@/app/providers/AuthProvider';

import { AuthSpinner } from '@/features/auth/components/AuthSpinner';



export function ProtectedRoute() {

  const { isAuthenticated, isLoading } = useAuth();

  const location = useLocation();



  if (isLoading) {

    return <AuthSpinner />;

  }



  if (!isAuthenticated) {

    return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  }



  return <Outlet />;

}



export function GuestRoute() {

  const { isAuthenticated, isLoading } = useAuth();



  if (isLoading) return <AuthSpinner />;

  if (isAuthenticated) return <Navigate to="/" replace />;

  return <Outlet />;

}


