import axios from 'axios';

/**
 * Centralized Axios instance for all SupportIQ API calls.
 *
 * - baseURL comes from the VITE_API_BASE_URL env variable.
 * - withCredentials: true is required so the browser sends the httpOnly
 *   JWT cookie on every request automatically.
 * - JWT is never stored in localStorage or exposed in JavaScript.
 * - X-Company-Id is injected via a mutable ref written by WorkspaceContext.
 *   The header value is derived from the server-verified membership;
 *   it is NOT proof of access on its own — every backend endpoint re-validates
 *   membership server-side on every request.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Mutable ref used by WorkspaceContext to inject the active company ID.
 * Never read from this ref directly in product code — use WorkspaceContext.
 */
export const companyHeaderRef = { current: null };

// Inject X-Company-Id before every request when a company is active.
api.interceptors.request.use((config) => {
  const companyId = companyHeaderRef.current;
  if (companyId) {
    config.headers['X-Company-Id'] = companyId;
  }
  return config;
});

export default api;
