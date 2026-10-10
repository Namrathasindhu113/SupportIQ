import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useWorkspace from '../../hooks/useWorkspace.js';
import useAuth from '../../hooks/useAuth.js';
import Button from '../../components/common/Button.jsx';
import ErrorMessage from '../../components/common/ErrorMessage.jsx';
import Spinner from '../../components/common/Spinner.jsx';

/**
 * WorkspaceSelectPage — shown when the user has memberships in multiple
 * companies and needs to pick one, or has no memberships at all.
 *
 * Route: /workspace/select
 */
const WorkspaceSelectPage = () => {
  const { memberships, loading, initialized, error, selectCompany } = useWorkspace();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);

  const handleSelect = async (entry) => {
    setSwitching(true);
    selectCompany(entry);
    // Navigate to the role-appropriate dashboard
    const role = entry.role;
    if (role === 'customer') {
      navigate('/customer/dashboard', { replace: true });
    } else {
      // agent and company_admin both go to agent dashboard
      navigate('/agent/dashboard', { replace: true });
    }
    setSwitching(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // Still loading memberships
  if (!initialized || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-3 text-sm text-gray-500">Loading your workspaces…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">SupportIQ</h1>
          <p className="mt-1 text-sm text-gray-500">
            Signed in as <span className="font-medium">{user?.name}</span>
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          {error && <ErrorMessage error={error} className="mb-5" />}

          {memberships.length === 0 ? (
            /* ── No workspaces ─────────────────────────────────────────────── */
            <div className="text-center">
              <div className="mb-4 flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-gray-100">
                <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                </svg>
              </div>
              <h2 className="mb-2 text-lg font-semibold text-gray-900">No workspaces yet</h2>
              <p className="mb-6 text-sm text-gray-500">
                Create a new workspace to get started, or use an invitation link to join an existing one.
              </p>
              <div className="flex flex-col gap-3">
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => navigate('/workspace/create')}
                >
                  Create a workspace
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => navigate('/workspace/join')}
                >
                  Join with invitation
                </Button>
              </div>
            </div>
          ) : (
            /* ── Multiple workspaces ───────────────────────────────────────── */
            <>
              <h2 className="mb-1 text-lg font-semibold text-gray-900">Select a workspace</h2>
              <p className="mb-5 text-sm text-gray-500">Choose which workspace to open.</p>

              <div className="space-y-2">
                {memberships.map((entry) => (
                  <button
                    key={entry.membershipId}
                    onClick={() => handleSelect(entry)}
                    disabled={switching}
                    className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 font-semibold text-sm">
                      {entry.company.name?.charAt(0).toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {entry.company.name}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">{entry.role.replace('_', ' ')}</p>
                    </div>
                    <svg className="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                ))}
              </div>

              <div className="mt-5 flex flex-col gap-2 border-t border-gray-100 pt-5">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => navigate('/workspace/create')}
                >
                  Create a new workspace
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => navigate('/workspace/join')}
                >
                  Join with invitation
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="mt-5 text-center">
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-600 hover:underline transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSelectPage;
