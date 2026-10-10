import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useWorkspace from '../../hooks/useWorkspace.js';
import useAuth from '../../hooks/useAuth.js';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import ErrorMessage from '../../components/common/ErrorMessage.jsx';
import { createCompanyApi } from '../../api/companyApi.js';

/**
 * WorkspaceCreatePage — create a new company workspace.
 * Route: /workspace/create
 */
const WorkspaceCreatePage = () => {
  const { selectCompany, refreshMemberships } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm]       = useState({ name: '', slug: '' });
  const [errors, setErrors]   = useState({});
  const [apiError, setApiError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Auto-generate a slug from the name
  const handleNameChange = (e) => {
    const name = e.target.value;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    setForm({ name, slug });
    setErrors((prev) => ({ ...prev, name: '', slug: '' }));
    setApiError(null);
  };

  const handleSlugChange = (e) => {
    const slug = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 60);
    setForm((prev) => ({ ...prev, slug }));
    setErrors((prev) => ({ ...prev, slug: '' }));
    setApiError(null);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())         e.name = 'Workspace name is required.';
    else if (form.name.length > 120) e.name = 'Name cannot exceed 120 characters.';
    if (!form.slug.trim())         e.slug = 'Slug is required.';
    else if (!/^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$|^[a-z0-9]{2}$/.test(form.slug))
      e.slug = 'Slug must be 2–60 lowercase letters, numbers, or hyphens.';
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
      const { company, membership } = await createCompanyApi({
        name: form.name.trim(),
        slug: form.slug,
      });

      // Refresh memberships list, then select the new company
      await refreshMemberships();
      selectCompany({
        membershipId: membership._id,
        company,
        role: membership.role,
        joinedAt: membership.createdAt,
      });

      // Navigate to role-appropriate dashboard
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
          <h1 className="text-2xl font-bold text-gray-900">Create workspace</h1>
          <p className="mt-1 text-sm text-gray-500">Set up your team's support workspace</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <ErrorMessage error={apiError} className="mb-5" />

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Input
              id="name"
              name="name"
              type="text"
              label="Workspace name"
              placeholder="Acme Corp Support"
              value={form.name}
              onChange={handleNameChange}
              error={errors.name}
              disabled={loading}
              autoFocus
            />

            <div>
              <Input
                id="slug"
                name="slug"
                type="text"
                label="Workspace slug"
                placeholder="acme-corp"
                value={form.slug}
                onChange={handleSlugChange}
                error={errors.slug}
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Lowercase letters, numbers, and hyphens only.
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="mt-2 w-full"
            >
              {loading ? 'Creating…' : 'Create workspace'}
            </Button>
          </form>
        </div>

        <div className="mt-5 text-center space-y-2">
          <p className="text-sm text-gray-500">
            Have an invitation?{' '}
            <Link to="/workspace/join" className="font-medium text-brand-600 hover:underline">
              Join with a token
            </Link>
          </p>
          <p className="text-sm text-gray-500">
            <Link to="/agent/portal" className="text-gray-400 hover:text-gray-600 hover:underline">
              ← Back to workspaces
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceCreatePage;
