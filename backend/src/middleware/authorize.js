import AppError from '../utils/AppError.js';

/**
 * authorize — role-based authorization middleware factory.
 *
 * Must be used AFTER the `protect` middleware (requires req.user).
 *
 * @param {...string} roles - Allowed roles, e.g. authorize('agent') or authorize('agent', 'customer')
 * @returns {Function} Express middleware
 *
 * @example
 * router.patch('/:id/status', protect, authorize('agent'), updateStatus);
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied. This action requires one of the following roles: ${roles.join(', ')}.`,
          403
        )
      );
    }
    next();
  };
};

export default authorize;
