import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import ErrorMessage from '../../components/common/ErrorMessage.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import useWorkspace from '../../hooks/useWorkspace.js';
import {
  getCompanyMembersApi,
  addMemberApi,
  createInvitationApi,
} from '../../api/companyApi.js';

const ROLE_OPTIONS = [
  { value: 'customer',      label: 'Customer' },
  { value: 'agent',         label: 'Agent' },
  { value: 'company_admin', label: 'Company Admin' },
];

const roleLabel = (role) => ROLE_OPTIONS.find(r => r.value === role)?.label ?? role;

const roleBadgeClass = (role) => {
  if (role === 'company_admin') return 'bg-purple-100 text-purple-700';
  if (role === 'agent')         return 'bg-blue-100 text-blue-700';
  return 'bg-gray-100 text-gray-600';
};

/**
 * WorkspaceManagePage — company admin view for managing workspace members.
 * Route: /agent/workspace/manage
 * Access: company_admin only (non-admins see a friendly denial message)
 *
 * Backend also enforces company_admin via authorizeCompanyRole('company_admin').
 */
const WorkspaceManagePage = () => {
  // ── All hooks MUST be called unconditionally before any early return ───────
  const { company, membership } = useWorkspace();
  const navigate = useNavigate();

  const [members,       setMembers]       = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [membersError,  setMembersError]  = useState(null);
  const [form,          setForm]          = useState({ email: '', role: 'customer' });
  const [formErrors,    setFormErrors]    = useState({});
  const [addError,      setAddError]      = useState(null);
  const [addLoading,    setAddLoading]    = useState(false);
  const [addSuccess,    setAddSuccess]    = useState(null);
  const [inviteForm,    setInviteForm]    = useState({ email: '', role: 'customer' });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError,   setInviteError]   = useState(null);
  const [invitation,    setInvitation]    = useState(null);
  const [copyError,     setCopyError]     = useState(null);

  const loadMembers = async () => {
    if (!company) return;
    setLoadingMembers(true);
    setMembersError(null);
    try {
      const data = await getCompanyMembersApi(company._id);
      setMembers(data.members ?? []);
    } catch (err) {
      setMembersError(err);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    // Only fetch members when the current user is an admin; skip for agents
    // (they should not land here, but guard defensively)
    if (company && membership?.role === 'company_admin') {
      loadMembers();
    } else {
      setLoadingMembers(false);
    }
  }, [company?._id, membership?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── After all hooks: role guard ───────────────────────────────────────────
  if (membership?.role !== 'company_admin') {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center py-24">
          <p className="text-sm text-gray-500">
            Only company administrators can manage workspace members.
          </p>
        </div>
      </AppShell>
    );
  }

  const validateForm = () => {
    const e = {};
    if (!form.email.trim())                       e.email = 'Email is required.';
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email address.';
    if (!form.role)                               e.role  = 'Role is required.';
    return e;
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length) { setFormErrors(errors); return; }

    setAddLoading(true);
    setAddError(null);
    setAddSuccess(null);

    try {
      const result = await addMemberApi(company._id, {
        email: form.email.trim(),
        role:  form.role,
      });
      setAddSuccess(
        `${result.membership.user.name} (${result.membership.user.email}) ` +
        `added as ${roleLabel(form.role)}.`
      );
      setForm({ email: '', role: 'customer' });
      await loadMembers();
    } catch (err) {
      setAddError(err);
    } finally {
      setAddLoading(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(inviteForm.email.trim())) {
      setInviteError(new Error('Enter a valid email address.'));
      return;
    }

    setInviteLoading(true);
    setInviteError(null);
    setInvitation(null);
    setCopyError(null);
    try {
      const result = await createInvitationApi(company._id, {
        email: inviteForm.email.trim(),
        role: inviteForm.role,
      });
      setInvitation(result.invitation);
      setInviteForm({ email: '', role: 'customer' });
    } catch (err) {
      setInviteError(err);
    } finally {
      setInviteLoading(false);
    }
  };

  const invitationLink = invitation
    ? `${window.location.origin}/workspace/join?companyId=${encodeURIComponent(invitation.company)}&token=${encodeURIComponent(invitation.token)}`
    : '';

  const copyInvitationLink = async () => {
    try {
      await navigator.clipboard.writeText(invitationLink);
      setCopyError(null);
    } catch (err) {
      setCopyError(new Error('Could not copy automatically. Select and copy the invitation link.'));
    }
  };

  return (
    <AppShell>
      <div className="px-6 py-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/agent/dashboard')}
            className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
          >
            ← Back to dashboard
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Team & Members</h1>
          <p className="mt-1 text-sm text-gray-500">
            {company?.name} — Add members and manage their roles.
          </p>
        </div>

        {/* Add member form */}
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-gray-900">Add an existing member</h2>
          <p className="mb-4 text-sm text-gray-500">
            The user must already have a SupportIQ account. Enter their email address to add
            them to this workspace with the chosen role.
          </p>

          {addSuccess && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              ✓ {addSuccess}
            </div>
          )}
          {addError && <ErrorMessage error={addError} className="mb-4" />}

          <form onSubmit={handleAddMember} noValidate className="space-y-4">
            <Input
              id="member-email"
              name="email"
              type="email"
              label="User email address"
              placeholder="user@example.com"
              value={form.email}
              onChange={(e) => {
                setForm(p => ({ ...p, email: e.target.value }));
                setFormErrors(p => ({ ...p, email: '' }));
                setAddError(null);
                setAddSuccess(null);
              }}
              error={formErrors.email}
              disabled={addLoading}
            />

            <div>
              <label htmlFor="member-role" className="block text-sm font-medium text-gray-700 mb-1">
                Role in this workspace
              </label>
              <select
                id="member-role"
                value={form.role}
                onChange={(e) => setForm(p => ({ ...p, role: e.target.value }))}
                disabled={addLoading}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60"
              >
                {ROLE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {formErrors.role && (
                <p className="mt-1 text-xs text-red-600">{formErrors.role}</p>
              )}
            </div>

            <Button type="submit" variant="primary" loading={addLoading}>
              Add member
            </Button>
          </form>
        </div>

        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-gray-900">Invite a new member</h2>
          <p className="mb-4 text-sm text-gray-500">
            Create a single-use invitation for a customer or agent. Email delivery is not
            configured, so share the generated invitation link directly with the invited
            person. They must sign in or create an account using this email address.
          </p>
          {inviteError && <ErrorMessage error={inviteError} className="mb-4" />}

          <form onSubmit={handleInvite} noValidate className="space-y-4">
            <Input
              id="invite-email"
              name="invite-email"
              type="email"
              label="Invitee email address"
              placeholder="person@example.com"
              value={inviteForm.email}
              onChange={(e) => {
                setInviteForm((previous) => ({ ...previous, email: e.target.value }));
                setInviteError(null);
                setInvitation(null);
              }}
              disabled={inviteLoading}
            />
            <div>
              <label htmlFor="invite-role" className="mb-1 block text-sm font-medium text-gray-700">
                Role in this workspace
              </label>
              <select
                id="invite-role"
                value={inviteForm.role}
                onChange={(e) => {
                  setInviteForm((previous) => ({ ...previous, role: e.target.value }));
                  setInvitation(null);
                }}
                disabled={inviteLoading}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="primary" loading={inviteLoading}>
              Create invitation
            </Button>
          </form>

          {invitation && (
            <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-medium text-green-800">
                Invitation created for {invitation.email} as {roleLabel(invitation.role)}.
              </p>
              <p className="mt-1 text-xs text-green-700">
                Expires {new Date(invitation.expiresAt).toLocaleString()}. This token is shown
                once; share the link now. No email has been sent.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  aria-label="Invitation link"
                  readOnly
                  value={invitationLink}
                  className="min-w-0 flex-1 rounded-lg border border-green-300 bg-white px-3 py-2 text-xs text-gray-700"
                />
                <Button type="button" variant="secondary" size="sm" onClick={copyInvitationLink}>
                  Copy link
                </Button>
              </div>
              {copyError && <p className="mt-2 text-xs text-red-700">{copyError.message}</p>}
            </div>
          )}
        </div>

        {/* Current members */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">
              Current members
            </h2>
          </div>

          {loadingMembers ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : membersError ? (
            <div className="px-6 py-4"><ErrorMessage error={membersError} /></div>
          ) : members.length === 0 ? (
            <p className="px-6 py-6 text-sm text-gray-400 italic">No members yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {members.map((m) => (
                <li key={m.membershipId} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600">
                      {m.user?.name?.charAt(0).toUpperCase() ?? '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{m.user?.name}</p>
                      <p className="text-xs text-gray-500">{m.user?.email}</p>
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${roleBadgeClass(m.role)}`}>
                    {roleLabel(m.role)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default WorkspaceManagePage;
