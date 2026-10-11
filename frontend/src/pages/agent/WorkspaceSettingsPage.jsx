import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import ErrorMessage from '../../components/common/ErrorMessage.jsx';
import useWorkspace from '../../hooks/useWorkspace.js';
import { updateCompanySettingsApi } from '../../api/companyApi.js';

const WorkspaceSettingsPage = () => {
  const { company, membership, selectCompany } = useWorkspace();
  const [name, setName] = useState(company?.name ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(company?.name ?? '');
  }, [company?._id, company?.name]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim()) {
      setError(new Error('Workspace name is required.'));
      return;
    }

    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const { company: updatedCompany } = await updateCompanySettingsApi(company._id, {
        name: name.trim(),
      });
      selectCompany({ ...membership, company: updatedCompany });
      setSaved(true);
    } catch (requestError) {
      setError(requestError);
    } finally {
      setLoading(false);
    }
  };

  if (membership?.role !== 'company_admin') {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-6 py-12">
          <Link
            to="/agent/portal"
            className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
          >
            ← Back to Companies &amp; Workspaces
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Workspace Settings</h1>
          <p className="mt-2 text-sm text-gray-600">
            Only a company administrator can change workspace settings.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-8">
          <Link
            to="/agent/portal"
            className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
          >
            ← Back to Companies &amp; Workspaces
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Workspace Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Update settings for {company?.name}. Changes apply only to this company.
          </p>
        </div>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Company details</h2>
          <p className="mb-5 mt-1 text-sm text-gray-500">
            The workspace URL slug is fixed after creation.
          </p>

          {error && <ErrorMessage error={error} className="mb-4" />}
          {saved && (
            <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              Workspace settings saved.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="workspace-name"
              name="name"
              label="Company name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSaved(false);
              }}
              disabled={loading}
              maxLength={120}
            />
            <div>
              <label htmlFor="workspace-slug" className="mb-1 block text-sm font-medium text-gray-700">
                Workspace slug
              </label>
              <input
                id="workspace-slug"
                value={company?.slug ?? ''}
                readOnly
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
              />
            </div>
            <Button type="submit" variant="primary" loading={loading}>
              Save settings
            </Button>
          </form>
        </section>
      </div>
    </AppShell>
  );
};

export default WorkspaceSettingsPage;
