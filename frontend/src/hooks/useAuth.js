import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';

/**
 * useAuth — convenience hook to consume AuthContext.
 *
 * Throws if used outside <AuthProvider>.
 *
 * @returns {{ user, loading, isAuthenticated, login, register, logout, refreshUser }}
 */
const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
};

export default useAuth;
