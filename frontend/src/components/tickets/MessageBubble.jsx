import React from 'react';
import { formatDateTime } from '../../utils/formatDate.js';

/**
 * MessageBubble — single message in a ticket conversation.
 * Customer messages align right, agent messages align left.
 * @param {{ message: object, currentUserId: string }} props
 */
const MessageBubble = ({ message, currentUserId }) => {
  const isOwn   = message.sender?._id === currentUserId || message.sender?.id === currentUserId;
  const isAgent = message.sender?.role === 'agent';

  return (
    <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold
        ${isAgent ? 'bg-brand-100 text-brand-700' : 'bg-gray-200 text-gray-700'}`}>
        {message.sender?.name?.charAt(0).toUpperCase() ?? '?'}
      </div>

      {/* Bubble */}
      <div className={`max-w-[72%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-gray-700">
            {message.sender?.name ?? 'Unknown'}
          </span>
          {isAgent && (
            <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
              Agent
            </span>
          )}
        </div>
        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed
          ${isOwn
            ? 'rounded-tr-sm bg-brand-600 text-white'
            : 'rounded-tl-sm bg-white border border-gray-200 text-gray-800'}`}>
          {message.body}
        </div>
        <span className="text-[11px] text-gray-400">{formatDateTime(message.createdAt)}</span>
      </div>
    </div>
  );
};

export default MessageBubble;
