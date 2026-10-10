import Ticket from '../models/Ticket.js';
import AppError from '../utils/AppError.js';

/**
 * ownerOrAgent — ticket ownership + tenant isolation middleware.
 *
 * Must be used AFTER `protect`.
 * When `requireMembership` has already run (req.membership is set), it ALSO
 * enforces company-level isolation:
 *
 *   - The ticket must belong to the authenticated user's active company.
 *   - company_admin and agent roles can access any ticket in their company.
 *   - customer role can access only their own tickets in their company.
 *
 * When req.membership is absent (legacy / pre-migration path), behaviour falls
 * back to the original global role check so existing demo data still works.
 *
 * Attaches the resolved Ticket document to `req.ticket`.
 */
const ownerOrAgent = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return next(new AppError('Ticket not found.', 404));
    }

    if (req.membership) {
      // ── Company-scoped path ──────────────────────────────────────────────
      const companyId = req.membership.company.toString();
      const role      = req.membership.role;

      // Ticket must belong to this company
      // (tickets with company===null are legacy; treat as not belonging to any
      //  company-scoped workspace — reject to avoid data leakage)
      if (!ticket.company || ticket.company.toString() !== companyId) {
        return next(new AppError('Ticket not found.', 404));
      }

      // company_admin and agent can see all tickets in the company
      if (role === 'company_admin' || role === 'agent') {
        req.ticket = ticket;
        return next();
      }

      // customer can only see their own tickets
      if (ticket.customer.toString() !== req.user._id.toString()) {
        return next(new AppError('You do not have permission to access this ticket.', 403));
      }

    } else {
      // ── Legacy / pre-migration path (no membership context) ─────────────
      const isAgent = req.user.role === 'agent';
      const isOwner = ticket.customer.toString() === req.user._id.toString();

      if (!isAgent && !isOwner) {
        return next(new AppError('You do not have permission to access this ticket.', 403));
      }
    }

    req.ticket = ticket;
    next();
  } catch (error) {
    next(error);
  }
};

export default ownerOrAgent;
