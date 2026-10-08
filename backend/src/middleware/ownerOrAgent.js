import Ticket from '../models/Ticket.js';
import AppError from '../utils/AppError.js';

/**
 * ownerOrAgent — ticket ownership middleware.
 *
 * Must be used AFTER `protect`. Fetches the ticket from the DB and:
 *   - Allows agents through unconditionally.
 *   - Allows the ticket's own customer through.
 *   - Returns 403 for any other customer.
 *   - Returns 404 when the ticket doesn't exist.
 *
 * Attaches the resolved ticket to `req.ticket` so downstream
 * controllers can reuse it without an extra DB call.
 *
 * Expects `req.params.id` to be the ticket ID.
 */
const ownerOrAgent = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return next(new AppError('Ticket not found.', 404));
    }

    const isAgent = req.user.role === 'agent';
    const isOwner = ticket.customer.toString() === req.user._id.toString();

    if (!isAgent && !isOwner) {
      return next(new AppError('You do not have permission to access this ticket.', 403));
    }

    req.ticket = ticket; // reuse in controller
    next();
  } catch (error) {
    next(error);
  }
};

export default ownerOrAgent;
