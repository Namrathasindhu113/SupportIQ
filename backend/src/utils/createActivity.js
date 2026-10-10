import Activity from '../models/Activity.js';

/**
 * Persist an Activity record for a ticket action.
 *
 * @param {object} params
 * @param {string} params.ticketId         - Ticket ObjectId
 * @param {string} params.actorId          - User ObjectId who performed the action
 * @param {string} params.type             - One of the ACTIVITY_TYPES enum values
 * @param {object} [params.meta={}]        - Optional metadata
 * @param {string} [params.companyId]      - Company ObjectId (tenant context); written
 *                                           when provided, omitted for legacy records
 */
const createActivity = ({ ticketId, actorId, type, meta = {}, companyId }) => {
  return Activity.create({
    ticket:  ticketId,
    actor:   actorId,
    type,
    meta,
    ...(companyId != null ? { company: companyId } : {}),
  });
};

export default createActivity;
