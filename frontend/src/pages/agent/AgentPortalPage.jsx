import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useWorkspace from '../../hooks/useWorkspace.js';
import useAuth from '../../hooks/useAuth.js';
import Button from '../../components/common/Button.jsx';
import ErrorMessage from '../../components/common/ErrorMessage.jsx';
import Spinner from '../../components/common/Spinner.jsx';

const BuildingIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
  </svg>
);

const PlusIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

/**
 * AgentPortalPage — the Agent Portal hub page.
 *
 * Shown when an agent has multiple workspaces and needs to choose one,
 * or when they first land after login before a workspace is selected.
 *
 * Agents and company_admins can:
 *   - See all workspaces they have access to
 *   - Open a workspace to manage its tickets
 *   - Create a new workspace (any authenticated agent)
 *   - Join a workspace via invitation token
 *
 * This page is NOT shown to customers.
 */
const AgentPortalPage = () => {
  const {
    memberships,
    loading,
    initialized,
    error,
    selectCompany,
    refreshMemberships,
  } = useWorkspace();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);
  const workspaces = memberships.filter(
    (entry) => entry.role === 'agent' || entry.role === 'company_admin'
  );
  const canCreateCompany = user?.role === 'agent';

  const handleSelect = (entry) => {
    setSwitching(true);
    selectCompany(entry);
    navigate('/agent/dashboard', { replace: true });
    setSwitching(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (!initialized || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-3 text-sm text-gray-500">Loading workspaces…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900">SupportIQ — Agent Portal</h1>
              <p className="text-xs text-gray-500">{user?.name} · {user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        {error ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <ErrorMessage error={error} className="mb-4 text-left" />
            <Button variant="secondary" onClick={refreshMemberships}>Try again</Button>
          </div>
        ) : workspaces.length === 0 ? (
          /* ── No workspaces ─────────────────────────────────────────────── */
          <div className="mx-auto max-w-md">
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center">
              <div className="mb-5 flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-gray-100">
                <BuildingIcon />
              </div>
              <h2 className="mb-2 text-lg font-semibold text-gray-900">No company workspaces yet</h2>
              <p className="mb-6 text-sm text-gray-500">
                {canCreateCompany
                  ? 'Create a company workspace or accept an invitation to one.'
                  : 'Accept a company invitation to get started.'}
              </p>
              <div className="flex flex-col gap-3">
                {canCreateCompany && (
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => navigate('/workspace/create')}
                  >
                    <PlusIcon /> Create a company
                  </Button>
                )}
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => navigate('/workspace/join')}
                >
                  Join with invitation token
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* ── Workspace list ─────────────────────────────────────────────── */
          <div>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Companies & Workspaces</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Your company directory is separate from each workspace’s support operations.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/workspace/join')}
                >
                  Join workspace
                </Button>
                {canCreateCompany && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/workspace/create')}
                  >
                    <PlusIcon /> Create company
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((entry) => {
                const isAdmin = entry.role === 'company_admin';
                return (
                  <button
                    key={entry.membershipId}
                    onClick={() => handleSelect(entry)}
                    disabled={switching}
                    className="group flex flex-col items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:border-brand-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
                  >
                    {/* Company avatar */}
                    <div className="flex w-full items-center gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 text-sm font-bold">
                        {entry.company.name?.charAt(0).toUpperCase() ?? '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-gray-900 text-sm group-hover:text-brand-700">
                          {entry.company.name}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">
                          {isAdmin ? '⚙️ Company Admin' : '🎫 Support Agent'}
                        </p>
                      </div>
                      <ChevronRightIcon />
                    </div>

                    {/* Divider */}
                    <div className="w-full border-t border-gray-100" />

                    <div className="flex w-full items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {isAdmin ? 'Company admin' : 'Support agent'}
                      </span>
                      <span className="text-xs font-semibold text-brand-700">
                        Open Workspace
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentPortalPage;
