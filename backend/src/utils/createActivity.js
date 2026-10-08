import Activity from '../models/Activity.js';

/**
 * Persist an Activity record for a ticket action.
 *
 * Designed to be fire-and-forget in controllers — awaited so errors
 * propagate, but callers can choose to try/catch independently.
 *
 * @param {object} params
 * @param {string} params.ticketId  - Ticket ObjectId (string or ObjectId)
 * @param {string} params.actorId   - User ObjectId who performed the action
 * @param {string} params.type      - One of the ACTIVITY_TYPES enum values
 * @param {object} [params.meta={}] - Optional metadata (from/to, agentName, etc.)
 *
 * @returns {Promise<Activity>}
 *
 * @example
 * await createActivity({
 *   ticketId: ticket._id,
 *   actorId:  req.user.id,
 *   type:     'status_changed',
 *   meta:     { from: 'open', to: 'in_progress' },
 * });
 */
const createActivity = ({ ticketId, actorId, type, meta = {} }) => {
  return Activity.create({
    ticket: ticketId,
    actor: actorId,
    type,
    meta,
  });
};

export default createActivity;
