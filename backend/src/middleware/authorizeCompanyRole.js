import AppError from '../utils/AppError.js';

/**
 * authorizeCompanyRole — company-scoped role check.
 *
 * Must be used AFTER `requireMembership`. Checks req.membership.role
 * (not the global req.user.role) against the allowed roles list.
 *
 * @param {...string} roles - Allowed company roles
 * @returns Express middleware
 *
 * @example
 * router.post('/invitations', protect, requireMembership,
 *   authorizeCompanyRole('company_admin'), createInvitation);
 */
const authorizeCompanyRole = (...roles) => (req, res, next) => {
  if (!req.membership) {
    // Guard: requireMembership must have run first
    return next(new AppError('Membership context is missing.', 500));
  }
  if (!roles.includes(req.membership.role)) {
    return next(new AppError(
      `Access denied. Required company role: ${roles.join(' or ')}.`,
      403
    ));
  }
  next();
};

export default authorizeCompanyRole;
