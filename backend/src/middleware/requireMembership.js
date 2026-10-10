import Membership from '../models/Membership.js';
import Company from '../models/Company.js';
import AppError from '../utils/AppError.js';
import mongoose from 'mongoose';

/**
 * requireMembership — tenant isolation middleware.
 *
 * Must be used AFTER `protect`. Reads the target company from
 * the `X-Company-Id` request header and verifies the authenticated
 * user has an **active** membership in that company.
 *
 * On success it attaches:
 *   req.company    — the Company document
 *   req.membership — the Membership document (includes .role)
 *
 * The downstream authorize() middleware can then check
 * req.membership.role (which is company-scoped) rather than the
 * global req.user.role.
 *
 * Usage:
 *   router.use(protect, requireMembership);
 *   router.get('/tickets', authorizeCompanyRole('agent', 'company_admin'), ...);
 */
const requireMembership = async (req, res, next) => {
  try {
    const companyId = req.headers['x-company-id'];

    if (!companyId) {
      return next(new AppError(
        'X-Company-Id header is required. Specify your active workspace.',
        400
      ));
    }

    if (!mongoose.isValidObjectId(companyId)) {
      return next(new AppError('Company ID is invalid.', 400));
    }

    // Validate the company exists (reject non-existent IDs early)
    const company = await Company.findById(companyId).lean();
    if (!company) {
      return next(new AppError('Company not found.', 404));
    }

    // Validate the authenticated user has an active membership
    const membership = await Membership.findOne({
      user: req.user._id,
      company: companyId,
      active: true,
    }).lean();

    if (!membership) {
      return next(new AppError(
        'You do not have an active membership in this company.',
        403
      ));
    }

    req.company = company;
    req.membership = membership;
    next();
  } catch (error) {
    next(error);
  }
};

export default requireMembership;
