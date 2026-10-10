import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAuth from '../hooks/useAuth.js';
import useWorkspace from '../hooks/useWorkspace.js';
import Spinner from '../components/common/Spinner.jsx';
import ErrorMessage from '../components/common/ErrorMessage.jsx';

/**
 * AgentOnlyRoute — blocks customers from accessing agent-only routes.
 *
 * Customers who try to navigate to workspace management or agent-only pages
 * are redirected to their access-pending screen.
 *
 * Must be nested inside <ProtectedRoute> so `user` is guaranteed.
 */
const AgentOnlyRoute = () => {
  const { user } = useAuth();
  const { membership, loading, initialized, error } = useWorkspace();

  if (!initialized || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm"><ErrorMessage error={error} /></div>
      </div>
    );
  }

  const activeRole = membership?.role ?? user?.role;

  if (
    activeRole !== 'agent'
    && activeRole !== 'company_admin'
    && user?.role !== 'agent'
  ) {
    return <Navigate to="/customer/access-pending" replace />;
  }

  return <Outlet />;
};

export default AgentOnlyRoute;
