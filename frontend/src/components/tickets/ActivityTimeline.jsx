import React from 'react';
import { activityLabel } from '../../utils/ticketHelpers.js';
import { timeAgo } from '../../utils/formatDate.js';

/**
 * ActivityTimeline — chronological list of ticket events.
 * @param {{ activities: array }} props
 */
const ActivityTimeline = ({ activities = [] }) => {
  if (!activities.length) {
    return <p className="text-sm text-gray-400 italic">No activity recorded yet.</p>;
  }

  return (
    <ol className="space-y-3">
      {activities.map((a, i) => (
        <li key={a._id ?? i} className="flex gap-3">
          {/* Dot + line */}
          <div className="flex flex-col items-center">
            <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-brand-400" />
            {i < activities.length - 1 && (
              <div className="mt-1 flex-1 w-px bg-gray-200" />
            )}
          </div>
          <div className="pb-3">
            <p className="text-sm text-gray-700">{activityLabel(a)}</p>
            <p className="text-xs text-gray-400">{timeAgo(a.createdAt)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
};

export default ActivityTimeline;
