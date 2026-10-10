import React from 'react';
import useAuth from '../../hooks/useAuth.js';
import { useNavigate } from 'react-router-dom';

/**
 * CustomerAccessPending — shown when a customer account exists but has
 * no active company membership.
 *
 * The customer cannot create or join a workspace themselves.
 * A company administrator must add them.
 */
const CustomerAccessPending = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-600">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">SupportIQ</h1>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          {/* Pending icon */}
          <div className="mb-5 flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-amber-100">
            <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h2 className="mb-2 text-xl font-semibold text-gray-900">Access Pending</h2>
          <p className="mb-1 text-sm text-gray-500">
            Hello, <span className="font-medium text-gray-700">{user?.name}</span>.
          </p>
          <p className="mb-6 text-sm text-gray-500">
            Your account has been created but you haven't been added to a support workspace yet.
          </p>

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-left">
            <p className="text-sm font-medium text-amber-800 mb-1">What happens next?</p>
            <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
              <li>A company administrator will add your account to the workspace.</li>
              <li>Once added, you'll be able to submit and track support tickets.</li>
              <li>You'll receive a notification when your access is approved.</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 space-y-2 text-center">
          <p className="text-xs text-gray-400">
            Signed in as {user?.email}
          </p>
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

export default CustomerAccessPending;
