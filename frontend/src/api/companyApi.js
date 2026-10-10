import api from './axios.js';

// ── Company CRUD ──────────────────────────────────────────────────────────────

/**
 * List all companies the current user has an active membership in.
 * @returns {Promise<{ memberships: Array<{ membershipId, company, role, joinedAt }> }>}
 */
export const getMyCompaniesApi = () =>
  api.get('/companies/my').then((r) => r.data.data);

/**
 * Create a new company workspace. Caller becomes the first company_admin.
 * @param {{ name: string, slug: string }} data
 * @returns {Promise<{ company, membership }>}
 */
export const createCompanyApi = (data) =>
  api.post('/companies', data).then((r) => r.data.data);

/**
 * Get details of a company the user is a member of.
 * Requires X-Company-Id header (set automatically by WorkspaceContext).
 * @param {string} companyId
 */
export const getCompanyApi = (companyId) =>
  api.get(`/companies/${companyId}`).then((r) => r.data.data);

/** Update editable settings for a company (company_admin only). */
export const updateCompanySettingsApi = (companyId, data) =>
  api.patch(`/companies/${companyId}`, data).then((r) => r.data.data);

/**
 * List active members of the current company.
 * Requires X-Company-Id header.
 * @param {string} companyId
 */
export const getCompanyMembersApi = (companyId) =>
  api.get(`/companies/${companyId}/members`).then((r) => r.data.data);

// ── Invitations ───────────────────────────────────────────────────────────────

/**
 * Create an invitation for a given email + role.
 * Returns the plaintext token once — display it and do not persist.
 * Requires company_admin membership (X-Company-Id set automatically).
 * @param {string} companyId
 * @param {{ email: string, role: string }} data
 */
export const createInvitationApi = (companyId, data) =>
  api.post(`/companies/${companyId}/invitations`, data).then((r) => r.data.data);

/**
 * Consume an invitation token to join a company.
 * @param {string} companyId
 * @param {{ token: string }} data
 */
export const joinCompanyApi = (companyId, data) =>
  api.post(`/companies/${companyId}/join`, data).then((r) => r.data.data);

/**
 * Directly add an existing user to the company by email.
 * Requires company_admin membership (X-Company-Id set automatically).
 * @param {string} companyId
 * @param {{ email: string, role: string }} data
 */
export const addMemberApi = (companyId, data) =>
  api.post(`/companies/${companyId}/members`, data).then((r) => r.data.data);
