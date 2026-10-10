import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { companyHeaderRef } from '../api/axios.js';
import { getMyCompaniesApi } from '../api/companyApi.js';
import { AuthContext } from './AuthContext.jsx';

export const WorkspaceContext = createContext(null);

/**
 * WorkspaceProvider — manages the active company workspace.
 *
 * Lifecycle:
 *  1. When `user` becomes non-null, fetch their memberships.
 *  2. Try to restore a previously selected company from sessionStorage
 *     (keyed by user ID, so switching accounts clears it).
 *  3. If exactly one membership exists, auto-select it.
 *  4. Otherwise surface the selector UI by leaving `company` null.
 *
 * Exposed state:
 *   memberships  — Array<{ membershipId, company, role, joinedAt }>
 *   company      — the active Company object | null
 *   membership   — the active Membership record | null
 *   loading      — true while memberships are being fetched
 *   initialized  — true once the workspace bootstrap has settled
 *                  (company may still be null if user has none / needs to pick)
 *   error        — fetch error | null
 *
 * Exposed functions:
 *   selectCompany(membershipEntry)  — set the active workspace
 *   clearWorkspace()                — deselect (e.g. on logout)
 *   refreshMemberships()            — re-fetch memberships
 */
export function WorkspaceProvider({ children }) {
  const { user } = useContext(AuthContext);

  const [memberships,  setMemberships]  = useState([]);
  const [company,      setCompany]      = useState(null);
  const [membership,   setMembership]   = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [initialized,  setInitialized]  = useState(false);
  const [error,        setError]        = useState(null);

  // Keep a ref to the current user ID so the sessionStorage key stays stable
  // even during async transitions.
  const userIdRef = useRef(null);

  // ── Sync the axios interceptor whenever the active company changes ─────────
  useEffect(() => {
    companyHeaderRef.current = company?._id?.toString() ?? null;
  }, [company]);

  // ── sessionStorage helpers (keyed by user ID) ─────────────────────────────
  const storageKey = (uid) => `siq_workspace_${uid}`;

  const persistSelection = useCallback((uid, companyId) => {
    try {
      if (companyId) sessionStorage.setItem(storageKey(uid), companyId);
      else           sessionStorage.removeItem(storageKey(uid));
    } catch (_) { /* storage may be blocked in some contexts */ }
  }, []);

  const readPersistedId = useCallback((uid) => {
    try { return sessionStorage.getItem(storageKey(uid)) ?? null; }
    catch (_) { return null; }
  }, []);

  // ── Core: select a workspace from the memberships list ────────────────────
  const selectCompany = useCallback((membershipEntry) => {
    if (!membershipEntry) {
      setCompany(null);
      setMembership(null);
      persistSelection(userIdRef.current, null);
      return;
    }
    setCompany(membershipEntry.company);
    setMembership(membershipEntry);
    persistSelection(userIdRef.current, membershipEntry.company._id?.toString());
  }, [persistSelection]);

  // ── Clear workspace (called on logout) ───────────────────────────────────
  const clearWorkspace = useCallback(() => {
    setMemberships([]);
    setCompany(null);
    setMembership(null);
    setInitialized(false);
    setError(null);
    if (userIdRef.current) persistSelection(userIdRef.current, null);
    userIdRef.current = null;
    companyHeaderRef.current = null;
  }, [persistSelection]);

  // ── Re-fetch memberships (e.g. after joining a company) ──────────────────
  const refreshMemberships = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getMyCompaniesApi();
      const list = data.memberships ?? [];
      setMemberships(list);
      return list;
    } catch (err) {
      setError(err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ── Bootstrap: run whenever the authenticated user changes ───────────────
  useEffect(() => {
    if (!user) {
      clearWorkspace();
      return;
    }

    // Different user logged in — clear previous state
    if (userIdRef.current && userIdRef.current !== user.id) {
      setCompany(null);
      setMembership(null);
      companyHeaderRef.current = null;
    }
    userIdRef.current = user.id;

    let cancelled = false;

    const bootstrap = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getMyCompaniesApi();
        if (cancelled) return;

        const list = data.memberships ?? [];
        setMemberships(list);

        if (list.length === 0) {
          // No memberships — show create/join screen
          setCompany(null);
          setMembership(null);
          return;
        }

        if (user.role === 'customer') {
          // Customers have an assigned company context and never choose a
          // workspace. Invite roles are still company-scoped, so a customer
          // account invited as an agent is routed by that membership.
          const assigned = list.find((entry) => entry.role !== 'customer') ?? list[0];
          setCompany(assigned.company);
          setMembership(assigned);
          persistSelection(user.id, assigned.company._id?.toString());
          return;
        }

        // Try to restore the previously selected company for this user
        const storedId = readPersistedId(user.id);
        const restored = storedId
          ? list.find((m) => m.company._id?.toString() === storedId)
          : null;

        if (restored) {
          setCompany(restored.company);
          setMembership(restored);
        } else if (list.length === 1) {
          // Auto-select the only workspace
          setCompany(list[0].company);
          setMembership(list[0]);
          persistSelection(user.id, list[0].company._id?.toString());
        } else {
          // Multiple workspaces, none previously selected — show selector
          setCompany(null);
          setMembership(null);
        }
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    bootstrap();
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = {
    memberships,
    company,
    membership,
    loading,
    initialized,
    error,
    selectCompany,
    clearWorkspace,
    refreshMemberships,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
