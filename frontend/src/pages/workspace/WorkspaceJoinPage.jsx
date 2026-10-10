import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import useWorkspace from '../../hooks/useWorkspace.js';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import ErrorMessage from '../../components/common/ErrorMessage.jsx';
import { joinCompanyApi } from '../../api/companyApi.js';

/**
 * WorkspaceJoinPage — consume an invitation token to join a company.
 * Route: /workspace/join
 * Optional query params: ?companyId=...&token=...
 */
const WorkspaceJoinPage = () => {
  const [searchParams] = useSearchParams();
  const { selectCompany, refreshMemberships } = useWorkspace();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    companyId: searchParams.get('companyId') ?? '',
    token:     searchParams.get('token')     ?? '',
  });
  const [errors, setErrors]     = useState({});
  const [apiError, setApiError] = useState(null);
  const [loading, setLoading]   = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [e.target.name]: '' }));
    setApiError(null);
  };

  const validate = () => {
    const e = {};
    if (!form.companyId.trim()) e.companyId = 'Company ID is required.';
    if (!form.token.trim())     e.token     = 'Invitation token is required.';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    setApiError(null);
    try {
      const { company, membership } = await joinCompanyApi(form.companyId.trim(), {
        token: form.token.trim(),
      });

      // Refresh memberships then activate the newly joined company
      await refreshMemberships();
      selectCompany({
        membershipId: membership.membershipId,
        company,
        role: membership.role,
        joinedAt: membership.joinedAt,
      });

      const role = membership.role;
      navigate(
        role === 'customer' ? '/customer/dashboard' : '/agent/dashboard',
        { replace: true }
      );
    } catch (err) {
      setApiError(err);
    } finally {
      setLoading(false);
    }
  };

  // Human-readable error overrides for invitation-specific server messages
  const friendlyError = (() => {
    if (!apiError) return null;
    const msg = apiError?.response?.data?.message ?? apiError?.message ?? '';
    if (msg.includes('invalid') || msg.includes('expired') || msg.includes('used')) {
      return 'This invitation is invalid, expired, or has already been used.';
    }
    if (msg.includes('email')) {
      return 'This invitation was issued to a different email address.';
    }
    return null;
  })();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Join workspace</h1>
          <p className="mt-1 text-sm text-gray-500">
            Accept an invitation assigned to your signed-in email address.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          {(friendlyError || apiError) && (
            <ErrorMessage
              error={friendlyError ?? apiError}
              className="mb-5"
            />
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Input
              id="companyId"
              name="companyId"
              type="text"
              label="Company ID"
              placeholder="Paste the company ID from your invitation"
              value={form.companyId}
              onChange={handleChange}
              error={errors.companyId}
              disabled={loading}
            />

            <Input
              id="token"
              name="token"
              type="text"
              label="Invitation token"
              placeholder="Paste your invitation token"
              value={form.token}
              onChange={handleChange}
              error={errors.token}
              disabled={loading}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="mt-2 w-full"
            >
              {loading ? 'Joining…' : 'Join workspace'}
            </Button>
          </form>
        </div>

        <div className="mt-5 text-center">
          <p className="text-sm text-gray-500">
            Need an account? Register using the invited email address, then reopen the invitation link.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            <Link to="/" className="text-gray-400 hover:text-gray-600 hover:underline">
              ← Return to SupportIQ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceJoinPage;
