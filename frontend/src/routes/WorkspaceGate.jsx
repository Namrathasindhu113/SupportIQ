import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth.js';
import useWorkspace from '../hooks/useWorkspace.js';
import Spinner from '../components/common/Spinner.jsx';
import ErrorMessage from '../components/common/ErrorMessage.jsx';

/**
 * WorkspaceGate — ensures an active workspace is set before rendering
 * company-scoped pages (dashboards, tickets, etc.).
 *
 * Must be nested inside <ProtectedRoute> so `user` is guaranteed.
 *
 * Behaviour by role when no company is active:
 *   customer     → /customer/access-pending  (cannot create/join workspaces)
 *   agent/admin  → /agent/portal             (workspace list / creation hub)
 */
const WorkspaceGate = () => {
  const { user }                                               = useAuth();
  const { company, memberships, loading, initialized, error, refreshMemberships } = useWorkspace();
  const location = useLocation();

  if (!initialized || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-3 text-sm text-gray-500">Initializing workspace…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <ErrorMessage error={error} />
          <button
            onClick={refreshMemberships}
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!company) {
    // Fork by portal — customers cannot create or join workspaces
    const hasAgentMembership = memberships.some(
      (entry) => entry.role === 'agent' || entry.role === 'company_admin'
    );
    if (user?.role === 'customer' && !hasAgentMembership) {
      return <Navigate to="/customer/access-pending" replace />;
    }
    // Agents: go to the portal hub, preserving the intended destination
    return (
      <Navigate
        to="/agent/portal"
        state={{ from: location }}
        replace
      />
    );
  }

  return <Outlet />;
};

export default WorkspaceGate;
