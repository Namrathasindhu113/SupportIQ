import api from './axios.js';

/**
 * Register a new customer account.
 * @param {{ name: string, email: string, password: string }} data
 * @returns {Promise<{ user: { id, name, email, role } }>}
 */
export const registerApi = (data) =>
  api.post('/auth/register', data).then((res) => res.data.data);

/**
 * Log in with email and password (works for both roles).
 * Sets the httpOnly JWT cookie via the response Set-Cookie header.
 * @param {{ email: string, password: string }} data
 * @returns {Promise<{ user: { id, name, email, role } }>}
 */
export const loginApi = (data) =>
  api.post('/auth/login', data).then((res) => res.data.data);

/**
 * Log out the current session.
 * Clears the httpOnly cookie on the server side.
 */
export const logoutApi = () =>
  api.post('/auth/logout').then((res) => res.data);

/**
 * Fetch the currently authenticated user from the httpOnly cookie.
 * Returns null (not an error) when the user is unauthenticated (401).
 * @returns {Promise<{ id, name, email, role } | null>}
 */
export const getMeApi = async () => {
  try {
    const res = await api.get('/auth/me');
    return res.data.data.user;
  } catch (err) {
    if (err.response?.status === 401) return null;
    throw err;
  }
};
