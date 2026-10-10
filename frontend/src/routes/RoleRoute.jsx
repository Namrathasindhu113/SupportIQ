import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAuth from '../hooks/useAuth.js';
import useWorkspace from '../hooks/useWorkspace.js';
import Spinner from '../components/common/Spinner.jsx';

/**
 * RoleRoute — restricts access by company-scoped membership role.
 *
 * Must be nested inside <WorkspaceGate> so `membership` is guaranteed.
 *
 * The `role` prop accepts:
 *   'customer'  — membership.role === 'customer'
 *   'agent'     — membership.role === 'agent' OR 'company_admin'
 *                 (company_admin has a superset of agent permissions)
 *
 * Wrong role → redirect to the user's own portal entry point.
 */
const RoleRoute = ({ role }) => {
  const { user }              = useAuth();
  const { membership, loading } = useWorkspace();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!membership) {
    // No active membership — route by global user role to the correct portal
    if (user?.role === 'customer') return <Navigate to="/customer/access-pending" replace />;
    return <Navigate to="/agent/portal" replace />;
  }

  const mRole = membership.role;
  const allowed =
    role === 'customer'
      ? mRole === 'customer'
      : mRole === 'agent' || mRole === 'company_admin';

  if (!allowed) {
    // Route to the correct portal entry for the user's actual role
    const redirect = mRole === 'customer' ? '/customer/dashboard' : '/agent/dashboard';
    return <Navigate to={redirect} replace />;
  }

  return <Outlet />;
};

export default RoleRoute;
