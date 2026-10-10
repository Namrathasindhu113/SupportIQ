import React from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge.jsx';
import PriorityBadge from './PriorityBadge.jsx';
import { formatDate } from '../../utils/formatDate.js';
import { categoryConfig } from '../../utils/ticketHelpers.js';

/**
 * TicketCard — row-style card used in customer dashboard and agent queue.
 * @param {{ ticket: object, href: string }} props
 */
const TicketCard = ({ ticket, href }) => (
  <Link
    to={href}
    className="block rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-gray-900">{ticket.title}</p>
        {ticket.customer && (
          <p className="mt-0.5 text-xs text-gray-500">{ticket.customer.name ?? ticket.customer.email}</p>
        )}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <PriorityBadge priority={ticket.priority} />
        <StatusBadge   status={ticket.status} />
      </div>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
      <span>{categoryConfig[ticket.category]?.label ?? ticket.category}</span>
      {ticket.assignedTo && (
        <span>Assigned: {ticket.assignedTo.name ?? ticket.assignedTo.email}</span>
      )}
      <span className="ml-auto">{formatDate(ticket.createdAt)}</span>
    </div>
  </Link>
);

export default TicketCard;
