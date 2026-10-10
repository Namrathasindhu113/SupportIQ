import React, { createContext, useCallback, useEffect, useState } from 'react';
import { getMeApi, loginApi, logoutApi, registerApi } from '../api/authApi.js';

export const AuthContext = createContext(null);

/**
 * AuthProvider — wraps the entire app and provides authentication state.
 *
 * State shape:
 *   user          — { id, name, email, role } | null
 *   loading       — true while the initial /auth/me check is in flight
 *   isAuthenticated — derived: !!user
 *
 * Exposed functions:
 *   login(email, password)   → resolves with user, throws on failure
 *   register(name, email, password) → resolves with user, throws on failure
 *   logout()                 → clears user, throws on failure
 *   refreshUser()            → re-fetches /auth/me (e.g. after page focus)
 */
export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true); // true until initial /me completes

  // ── Bootstrap: check existing session on mount ───────────────────────────
  useEffect(() => {
    let cancelled = false;
    getMeApi()
      .then((u) => { if (!cancelled) setUser(u); })
      .catch(() => { if (!cancelled) setUser(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ── login ────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const data = await loginApi({ email, password });
    setUser(data.user);
    return data.user;
  }, []);

  // ── register ─────────────────────────────────────────────────────────────
  const register = useCallback(async (name, email, password) => {
    const data = await registerApi({ name, email, password });
    setUser(data.user);
    return data.user;
  }, []);

  // ── logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await logoutApi();
    setUser(null);
  }, []);

  // ── refreshUser ───────────────────────────────────────────────────────────
  const refreshUser = useCallback(async () => {
    const u = await getMeApi();
    setUser(u);
    return u;
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
