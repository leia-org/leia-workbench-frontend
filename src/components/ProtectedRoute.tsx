import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context';
import { toast } from 'react-toastify';

interface ProtectedRouteProps {
  requiredRoles?: string[];
}
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredRoles = ['admin'] }) => {
  const { token, user, isLoading, logout } = useAuth();
  useEffect(() => {
    if (!isLoading && token && requiredRoles && (!user?.role || !requiredRoles.includes(user.role))) {
      toast.error('Acceso denegado. Por seguridad se ha cerrado tu sesión.');
      logout();
    }
  }, [isLoading, token, requiredRoles, user?.role, logout]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles && (!user?.role || !requiredRoles.includes(user.role))) {
    return null;
  }

  return <Outlet />;
};

export default ProtectedRoute;
