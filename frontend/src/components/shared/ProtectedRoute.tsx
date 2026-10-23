import { useEffect, useMemo, type ReactNode } from 'react';
import { Navigate } from 'react-router';
import { toast } from 'sonner';

import { useAuthStore } from '@/stores/auth';
import Spinner from '@/views/spinner/Spinner';

interface ProtectedRouteProps {
  /** Role slug(s) allowed to access the route. Omit to require login only. */
  role?: string | string[];
  children: ReactNode;
}

/** Normalizes the optional `role` prop into a list for the access check. */
function toRoleList(role: ProtectedRouteProps['role']): string[] {
  if (!role) {
    return [];
  }

  return Array.isArray(role) ? role : [role];
}

/**
 * Guards authenticated routes.
 *
 * `hydrate()` restores the persisted session on the first render; while it runs
 * `isLoading` keeps a spinner on screen so the user never sees a
 * "not authenticated" flash. Unauthenticated users go to `/login`; an
 * authenticated user without the required role goes back to `/` with a toast.
 */
const ProtectedRoute = ({ role, children }: ProtectedRouteProps) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const userRole = useAuthStore((state) => state.user?.role ?? null);
  const hydrate = useAuthStore((state) => state.hydrate);

  const allowedRoles = useMemo(() => toRoleList(role), [role]);
  const isRoleDenied =
    isAuthenticated &&
    allowedRoles.length > 0 &&
    (userRole === null || !allowedRoles.includes(userRole));

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isRoleDenied) {
      toast.error('Você não tem permissão para acessar esta página.');
    }
  }, [isRoleDenied]);

  if (isLoading) {
    return <Spinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isRoleDenied) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
