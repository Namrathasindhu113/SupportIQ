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
import AIAnalysisPanel from '../../components/tickets/AIAnalysisPanel.jsx';
import Button from '../../components/common/Button.jsx';
import {
  getTicketByIdApi, getMessagesApi, sendMessageApi, getActivityApi,
  updateStatusApi, updatePriorityApi, updateCategoryApi,
  assignTicketApi, getAgentsApi, getAIAnalysisApi, generateAIAnalysisApi,
} from '../../api/ticketApi.js';
import { formatDate } from '../../utils/formatDate.js';
import {
  STATUS_OPTIONS, PRIORITY_OPTIONS, CATEGORY_OPTIONS, categoryConfig,
} from '../../utils/ticketHelpers.js';
import useAuth from '../../hooks/useAuth.js';

// ── Inline select control for the side panel ────────────────────────────────
const ControlSelect = ({ label, value, options, onChange, loading }) => (
  <div>
    <p className="mb-1 text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={loading}
      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);

const AgentTicketDetail = () => {
  const { id }   = useParams();
  const { user } = useAuth();

  const [ticket, setTicket]           = useState(null);
  const [messages, setMessages]       = useState([]);
  const [activities, setActivities]   = useState([]);
  const [agents, setAgents]           = useState([]);
  const [aiAnalysis, setAiAnalysis]   = useState(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [mutating, setMutating]       = useState(false);
  const [aiLoading, setAiLoading]     = useState(false);
  const [mutateError, setMutateError] = useState(null);
  const [pageError, setPageError]     = useState(null);
  const [aiError, setAiError]         = useState(null);
  const messagesEndRef                = useRef(null);

  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const reloadThread = useCallback(async () => {
    const [msgs, acts] = await Promise.all([getMessagesApi(id), getActivityApi(id)]);
    setMessages(msgs);
    setActivities(acts);
  }, [id]);

  const load = useCallback(async () => {
    setLoadingPage(true);
    setPageError(null);
    try {
      const [detail, msgs, acts, agentList] = await Promise.all([
        getTicketByIdApi(id),
        getMessagesApi(id),
        getActivityApi(id),
        getAgentsApi(),
      ]);
      setTicket(detail.ticket);
      setMessages(msgs);
      setActivities(acts);
      setAgents(agentList);
      
      // Try to fetch existing AI analysis in the background
      try {
        const aiResult = await getAIAnalysisApi(id);
        if (aiResult.success && aiResult.analysis) {
          setAiAnalysis(aiResult.analysis);
        }
      } catch (aiErr) {
        // Silently ignore AI analysis errors - it's optional
        console.log('AI analysis not available:', aiErr.message);
      }
    } catch (err) {
      setPageError(err);
    } finally {
      setLoadingPage(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (messages.length) scrollToBottom(); }, [messages]);

  // ── Mutation helpers ────────────────────────────────────────────────────────
  const mutate = async (apiFn) => {
    setMutating(true);
    setMutateError(null);
    try {
      const updated = await apiFn();
      setTicket(updated);
      await reloadThread();
    } catch (err) {
      setMutateError(err);
    } finally {
      setMutating(false);
    }
  };

  const handleStatusChange   = (v) => mutate(() => updateStatusApi(id, v));
  const handlePriorityChange = (v) => mutate(() => updatePriorityApi(id, v));
  const handleCategoryChange = (v) => mutate(() => updateCategoryApi(id, v));
  const handleAssignChange   = (v) => mutate(() => assignTicketApi(id, v === '' ? null : v));

  const handleSend = async (body) => {
    await sendMessageApi(id, body);
    await reloadThread();
  };

  const handleGetAIAnalysis = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await getAIAnalysisApi(id);
      if (result.success) {
        setAiAnalysis(result.analysis);
        if (result.analysis) {
          await reloadThread(); // Refresh activities to show ai_analyzed
        }
      }
    } catch (err) {
      setAiError(err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerateAIAnalysis = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await generateAIAnalysisApi(id);
      if (result.success) {
        setAiAnalysis(result.analysis);
        await reloadThread(); // Refresh activities to show ai_analyzed
      }
    } catch (err) {
      setAiError(err);
    } finally {
      setAiLoading(false);
    }
  };

  if (loadingPage) return (
    <AppShell><div className="flex justify-center py-24"><Spinner size="lg" /></div></AppShell>
  );
  if (pageError) return (
    <AppShell><div className="px-6 py-8"><ErrorMessage error={pageError} /></div></AppShell>
  );
  if (!ticket) return null;

  const agentOptions = [
    { value: '', label: 'Unassigned' },
    ...agents.map((a) => ({ value: a._id, label: a.name })),
  ];
  const currentAssignee = ticket.assignedTo?._id ?? ticket.assignedTo ?? '';

  return (
    <AppShell>
      <div className="px-6 py-6">
        {/* Breadcrumb */}
        <nav className="mb-4 text-sm text-gray-500">
          <Link to="/agent/tickets" className="hover:text-brand-600">Tickets</Link>
          <span className="mx-2">›</span>
          <span className="text-gray-900 font-medium truncate">{ticket.title}</span>
        </nav>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* ── Main column ──────────────────────────────────────── */}
          <div className="space-y-5 xl:col-span-2">
            {/* Header card */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1 className="text-xl font-bold text-gray-900 leading-snug flex-1 min-w-0">
                  {ticket.title}
                </h1>
                <div className="flex flex-shrink-0 gap-2">
                  <PriorityBadge priority={ticket.priority} />
                  <StatusBadge   status={ticket.status} />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
                <span>Customer: <span className="font-medium">{ticket.customer?.name ?? '—'}</span></span>
                <span>{ticket.customer?.email}</span>
                <span>{categoryConfig[ticket.category]?.label ?? ticket.category}</span>
                <span>Opened {formatDate(ticket.createdAt)}</span>
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
                  <p className="text-sm text-gray-400 italic text-center py-6">No messages yet.</p>
                ) : (
                  messages.map((m) => (
                    <MessageBubble key={m._id} message={m} currentUserId={user?.id} />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="border-t border-gray-100 px-6 pb-5 pt-4">
                <ReplyComposer onSend={handleSend} />
              </div>
            </div>

            {/* Activity timeline */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-gray-700">Activity timeline</h2>
              <ActivityTimeline activities={activities} />
            </div>
          </div>

          {/* ── Side panel ───────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Mutate error */}
            {mutateError && <ErrorMessage error={mutateError} />}

            {/* Controls */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">Ticket controls</h2>

              <ControlSelect
                label="Status"
                value={ticket.status}
                options={STATUS_OPTIONS}
                onChange={handleStatusChange}
                loading={mutating}
              />
              <ControlSelect
                label="Priority"
                value={ticket.priority}
                options={PRIORITY_OPTIONS}
                onChange={handlePriorityChange}
                loading={mutating}
              />
              <ControlSelect
                label="Category"
                value={ticket.category}
                options={CATEGORY_OPTIONS}
                onChange={handleCategoryChange}
                loading={mutating}
              />
              <ControlSelect
                label="Assigned to"
                value={currentAssignee}
                options={agentOptions}
                onChange={handleAssignChange}
                loading={mutating}
              />

              {mutating && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Spinner size="sm" /> Saving…
                </div>
              )}
            </div>

            {/* AI Analysis Panel */}
            <AIAnalysisPanel
              ticketId={id}
              initialAnalysis={aiAnalysis}
              onGetAnalysis={handleGetAIAnalysis}
              onGenerateAnalysis={handleGenerateAIAnalysis}
              loading={aiLoading}
              error={aiError}
            />

            {/* Customer info */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-700">Customer</h2>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
                  {ticket.customer?.name?.charAt(0).toUpperCase() ?? '?'}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {ticket.customer?.name ?? '—'}
                  </p>
                  <p className="truncate text-xs text-gray-500">{ticket.customer?.email}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default AgentTicketDetail;
