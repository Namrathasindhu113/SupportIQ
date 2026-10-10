import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth.js';
import useWorkspace from '../../hooks/useWorkspace.js';

/** Single sidebar navigation link */
const NavItem = ({ to, icon, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-brand-50 text-brand-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`
    }
  >
    <span className="h-5 w-5 flex-shrink-0">{icon}</span>
    {label}
  </NavLink>
);

// ── Icons ────────────────────────────────────────────────────────────────────
const HomeIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12L11.204 3.045a1.125 1.125 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>
);

const TicketIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a3 3 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
  </svg>
);

const CompanyIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
  </svg>
);

const TeamIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.941 3.199v-.3c0-1.957-.73-3.743-1.932-5.11M15 6.75a3 3 0 11-6 0 3 3 0 016 0zM4.26 16.52a9.094 9.094 0 013.74-.48m-7.5 3.3a3 3 0 014.682-2.72M8.26 19.72v-.3c0-1.957.73-3.743 1.932-5.11M6 6.75a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const PlusIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const LogoutIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
  </svg>
);

const SwitchIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
  </svg>
);

const SettingsIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

/**
 * Sidebar — application navigation shell.
 *
 * Portal split:
 *   Customer (mRole === 'customer'):
 *     - My Tickets, New Ticket
 *     - NO workspace management links
 *
 *   Agent / Company Admin (mRole === 'agent' | 'company_admin'):
 *     - Overview, Support Desk, Companies & Workspaces
 *     - Team & Members and Workspace Settings (company_admin only)
 *     - Switch workspace button (only when >1 membership)
 */
const Sidebar = () => {
  const { user, logout }                     = useAuth();
  const { company, membership, memberships } = useWorkspace();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const mRole      = membership?.role ?? user?.role;
  const isAdmin    = mRole === 'company_admin';
  const isAgent    = mRole === 'agent' || isAdmin;
  const isCustomer = mRole === 'customer';
  const hasAgentWorkspace = memberships.some(
    (entry) => entry.role === 'agent' || entry.role === 'company_admin'
  );

  return (
    <aside className="flex h-full w-60 flex-col border-r border-gray-200 bg-white">
      {/* Logo + Company name */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-5">
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-600">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </div>
          <span className="truncate text-base font-semibold text-gray-900">
            {company?.name ?? 'SupportIQ'}
          </span>
        </Link>

        {/* Switch workspace — agents/admins only, only when multiple workspaces exist */}
        {(isAgent || (user?.role === 'agent' && hasAgentWorkspace)) && memberships.length > 1 && (
          <button
            onClick={() => navigate('/agent/portal')}
            title="Switch workspace"
            className="ml-1 flex-shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <span className="h-4 w-4 block"><SwitchIcon /></span>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {isAgent && (
          <>
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Agent Portal
            </p>
            <NavItem to="/agent/dashboard" icon={<HomeIcon />} label="Overview" />
            <NavItem to="/agent/tickets" icon={<TicketIcon />} label="Support Desk" />
            <NavItem to="/agent/portal" icon={<CompanyIcon />} label="Companies & Workspaces" />

            {isAdmin && (
              <>
                <p className="mb-1 mt-4 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Workspace administration
                </p>
                <NavItem to="/agent/workspace/manage" icon={<TeamIcon />} label="Team & Members" />
                <NavItem to="/agent/workspace/settings" icon={<SettingsIcon />} label="Workspace Settings" />
              </>
            )}
          </>
        )}

        {isCustomer && (
          <>
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Support
            </p>
            <NavItem to="/customer/dashboard"   icon={<HomeIcon />}   label="My Tickets" />
            <NavItem to="/customer/tickets/new" icon={<PlusIcon />}   label="New Ticket" />
            {user?.role === 'agent' && hasAgentWorkspace && (
              <NavItem
                to="/agent/portal"
                icon={<CompanyIcon />}
                label="Companies & Workspaces"
              />
            )}
          </>
        )}
      </nav>

      {/* User + logout */}
      <div className="border-t border-gray-200 px-3 py-3">
        <div className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-semibold">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="truncate text-xs capitalize text-gray-500">
              {mRole?.replace(/_/g, ' ') ?? user?.role}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <span className="h-5 w-5"><LogoutIcon /></span>
          Sign out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
