import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import ErrorMessage from '../../components/common/ErrorMessage.jsx';
import StatusBadge from '../../components/tickets/StatusBadge.jsx';
import PriorityBadge from '../../components/tickets/PriorityBadge.jsx';
import MessageBubble from '../../components/tickets/MessageBubble.jsx';
import ReplyComposer from '../../components/tickets/ReplyComposer.jsx';
import ActivityTimeline from '../../components/tickets/ActivityTimeline.jsx';
import { getTicketByIdApi, getMessagesApi, sendMessageApi, getActivityApi } from '../../api/ticketApi.js';
import { formatDate } from '../../utils/formatDate.js';
import { categoryConfig } from '../../utils/ticketHelpers.js';
import useAuth from '../../hooks/useAuth.js';

const CustomerTicketDetail = () => {
  const { id }   = useParams();
  const { user } = useAuth();

  const [ticket, setTicket]         = useState(null);
  const [messages, setMessages]     = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const messagesEndRef               = useRef(null);

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, msgs, acts] = await Promise.all([
        getTicketByIdApi(id),
        getMessagesApi(id),
        getActivityApi(id),
      ]);
      setTicket(detail.ticket);
      setMessages(msgs);
      setActivities(acts);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (messages.length) scrollToBottom(); }, [messages]);

  const handleSend = async (body) => {
    await sendMessageApi(id, body);
    // Reload messages and activity without full page reload
    const [msgs, acts] = await Promise.all([getMessagesApi(id), getActivityApi(id)]);
    setMessages(msgs);
    setActivities(acts);
  };

  if (loading) return (
    <AppShell><div className="flex justify-center py-24"><Spinner size="lg" /></div></AppShell>
  );
  if (error) return (
    <AppShell><div className="px-6 py-8"><ErrorMessage error={error} /></div></AppShell>
  );
  if (!ticket) return null;

  return (
    <AppShell>
      <div className="px-6 py-6">
        {/* Breadcrumb */}
        <nav className="mb-4 text-sm text-gray-500">
          <Link to="/customer/dashboard" className="hover:text-brand-600">My Tickets</Link>
          <span className="mx-2">›</span>
          <span className="text-gray-900 font-medium truncate">{ticket.title}</span>
        </nav>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* ── Main column ─────────────────────────────────────── */}
          <div className="space-y-6 lg:col-span-2">
            {/* Ticket header */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1 className="text-xl font-bold text-gray-900 leading-snug">{ticket.title}</h1>
                <div className="flex gap-2">
                  <PriorityBadge priority={ticket.priority} />
                  <StatusBadge   status={ticket.status} />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
                <span>{categoryConfig[ticket.category]?.label ?? ticket.category}</span>
                <span>Opened {formatDate(ticket.createdAt)}</span>
                {ticket.assignedTo && <span>Agent: {ticket.assignedTo.name}</span>}
              </div>
              <p className="mt-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {ticket.description}
              </p>
            </div>

            {/* Conversation */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-3">
                <h2 className="text-sm font-semibold text-gray-700">
                  Conversation ({messages.length})
                </h2>
              </div>
              <div className="space-y-4 px-6 py-5 min-h-[120px]">
                {messages.length === 0 ? (
                  <p className="text-sm text-gray-400 italic text-center py-6">No messages yet. Start the conversation below.</p>
                ) : (
                  messages.map((m) => (
                    <MessageBubble key={m._id} message={m} currentUserId={user?.id} />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply */}
              {ticket.status !== 'closed' && (
                <div className="border-t border-gray-100 px-6 pb-5 pt-4">
                  <ReplyComposer onSend={handleSend} />
                </div>
              )}
              {ticket.status === 'closed' && (
                <div className="border-t border-gray-100 px-6 py-4">
                  <p className="text-sm text-gray-400 text-center italic">This ticket is closed.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Side panel ──────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Activity timeline */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-gray-700">Activity</h2>
              <ActivityTimeline activities={activities} />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default CustomerTicketDetail;
