import { useContext } from 'react';
import { WorkspaceContext } from '../context/WorkspaceContext.jsx';

/**
 * useWorkspace — consume WorkspaceContext.
 *
 * @returns {{
 *   memberships: Array,
 *   company: object|null,
 *   membership: object|null,
 *   loading: boolean,
 *   initialized: boolean,
 *   error: unknown,
 *   selectCompany: (membershipEntry: object) => void,
 *   clearWorkspace: () => void,
 *   refreshMemberships: () => Promise<Array>,
 * }}
 */
const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  }
  return ctx;
};

export default useWorkspace;
