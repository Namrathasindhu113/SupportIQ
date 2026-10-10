import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import useAuth from './hooks/useAuth.js';
import useWorkspace from './hooks/useWorkspace.js';
import ProtectedRoute  from './routes/ProtectedRoute.jsx';
import WorkspaceGate   from './routes/WorkspaceGate.jsx';
import RoleRoute       from './routes/RoleRoute.jsx';
import AgentOnlyRoute  from './routes/AgentOnlyRoute.jsx';
import Spinner         from './components/common/Spinner.jsx';

// Auth pages (public)
import LoginPage    from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';

// Agent Portal — workspace management (auth-required, not workspace-gated)
import AgentPortalPage     from './pages/agent/AgentPortalPage.jsx';
import WorkspaceCreatePage from './pages/workspace/WorkspaceCreatePage.jsx';
import WorkspaceJoinPage   from './pages/workspace/WorkspaceJoinPage.jsx';

// Customer access pending (auth-required, no workspace required)
import CustomerAccessPending from './pages/customer/CustomerAccessPending.jsx';

// Customer pages (workspace-scoped)
import CustomerDashboard    from './pages/customer/CustomerDashboard.jsx';
import NewTicketPage        from './pages/customer/NewTicketPage.jsx';
import CustomerTicketDetail from './pages/customer/CustomerTicketDetail.jsx';

// Agent / admin pages (workspace-scoped)
import AgentDashboard      from './pages/agent/AgentDashboard.jsx';
import AgentTicketList     from './pages/agent/AgentTicketList.jsx';
import AgentTicketDetail   from './pages/agent/AgentTicketDetail.jsx';
import WorkspaceManagePage from './pages/agent/WorkspaceManagePage.jsx';
import WorkspaceSettingsPage from './pages/agent/WorkspaceSettingsPage.jsx';

/**
 * RootRedirect — handles "/" after auth + workspace bootstrapping.
 *
 * Customer path:
 *   has membership → /customer/dashboard
 *   no membership  → /customer/access-pending
 *
 * Agent / company_admin path:
 *   has active workspace → /agent/dashboard
 *   no workspace yet     → /agent/portal  (workspace list / creation)
 */
const RootRedirect = () => {
  const { user, loading: authLoading }                         = useAuth();
  const { company, membership, loading: wsLoading, initialized } = useWorkspace();

  if (authLoading || wsLoading || !initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (company && membership?.role === 'customer') {
    return <Navigate to="/customer/dashboard" replace />;
  }

  if (company && (membership?.role === 'agent' || membership?.role === 'company_admin')) {
    return <Navigate to="/agent/dashboard" replace />;
  }

  if (user.role === 'customer') {
    return company
      ? <Navigate to="/customer/dashboard" replace />
      : <Navigate to="/customer/access-pending" replace />;
  }

  // Agent / company_admin
  return company
    ? <Navigate to="/agent/dashboard" replace />
    : <Navigate to="/agent/portal" replace />;
};

const App = () => (
  <Routes>
    {/* Root */}
    <Route path="/" element={<RootRedirect />} />

    {/* Public */}
    <Route path="/login"    element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />

    {/* Auth-required ─────────────────────────────────────────────────────── */}
    <Route element={<ProtectedRoute />}>

      {/* ── Customer access pending (no workspace required) ─────────────── */}
      {/* Shown when a customer account exists but has no active membership. */}
      <Route path="/customer/access-pending" element={<CustomerAccessPending />} />

      {/* ── Agent Portal — workspace management (agents/admins only) ──────── */}
      {/* These routes are NOT workspace-gated; customers are blocked by
          AgentOnlyRoute which redirects them to access-pending. */}
      <Route element={<AgentOnlyRoute />}>
        <Route path="/agent/portal"      element={<AgentPortalPage />} />
        <Route path="/workspace/create"  element={<WorkspaceCreatePage />} />
      </Route>
      <Route path="/workspace/join" element={<WorkspaceJoinPage />} />

      {/* ── Company-scoped pages — require auth + active workspace ─────────── */}
      <Route element={<WorkspaceGate />}>

        {/* Customer portal */}
        <Route element={<RoleRoute role="customer" />}>
          <Route path="/customer/dashboard"   element={<CustomerDashboard />} />
          <Route path="/customer/tickets/new" element={<NewTicketPage />} />
          <Route path="/customer/tickets/:id" element={<CustomerTicketDetail />} />
        </Route>

        {/* Agent / company_admin portal */}
        <Route element={<RoleRoute role="agent" />}>
          <Route path="/agent/dashboard"        element={<AgentDashboard />} />
          <Route path="/agent/tickets"          element={<AgentTicketList />} />
          <Route path="/agent/tickets/:id"      element={<AgentTicketDetail />} />
          <Route path="/agent/workspace/manage" element={<WorkspaceManagePage />} />
          <Route path="/agent/workspace/settings" element={<WorkspaceSettingsPage />} />
        </Route>

      </Route>
    </Route>

    {/* Catch-all */}
    <Route path="*" element={<RootRedirect />} />
  </Routes>
);

export default App;
