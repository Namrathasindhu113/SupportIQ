import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import ErrorMessage from '../../components/common/ErrorMessage.jsx';
import StatCard from '../../components/tickets/StatCard.jsx';
import TicketCard from '../../components/tickets/TicketCard.jsx';
import Button from '../../components/common/Button.jsx';
import useAuth from '../../hooks/useAuth.js';
import useWorkspace from '../../hooks/useWorkspace.js';
import { getTicketOverviewApi } from '../../api/ticketApi.js';

const ACTIVITY_LABELS = {
  ticket_created: 'Ticket created',
  status_changed: 'Status updated',
  priority_changed: 'Priority changed',
  category_changed: 'Category updated',
  assigned: 'Ticket assigned',
  unassigned: 'Ticket unassigned',
  replied: 'Customer or agent replied',
  ai_analyzed: 'AI analysis completed',
};

const AgentDashboard = () => {
  const { user } = useAuth();
  const { company, membership } = useWorkspace();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const loadOverview = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getTicketOverviewApi();
        if (!cancelled) setOverview(result);
      } catch (requestError) {
        if (!cancelled) setError(requestError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadOverview();
    return () => { cancelled = true; };
  }, [company?._id]);

  const metrics = overview?.metrics ?? {};
  const isAdmin = membership?.role === 'company_admin';

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-brand-700">{company?.name ?? 'Support operations'}</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Overview</h1>
            <p className="mt-1 text-sm text-gray-500">
              Welcome back, <span className="font-medium">{user?.name}</span>. Here’s the current support workload.
            </p>
          </div>
          <Link to="/agent/tickets">
            <Button variant="primary">Open Support Desk</Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : error ? (
          <ErrorMessage error={error} />
        ) : (
          <>
            <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-7">
              <StatCard label="Total tickets" value={metrics.total ?? 0} />
              <StatCard label="Open" value={metrics.open ?? 0} colorClass="text-blue-600" />
              <StatCard label="In progress" value={metrics.inProgress ?? 0} colorClass="text-amber-600" />
              <StatCard label="Resolved" value={metrics.resolved ?? 0} colorClass="text-green-600" />
              <StatCard label="Urgent" value={metrics.urgent ?? 0} colorClass="text-red-600" />
              <StatCard label="Unassigned" value={metrics.unassigned ?? 0} colorClass="text-orange-600" />
              <StatCard label="My workload" value={metrics.myAssigned ?? 0} colorClass="text-brand-700" />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
              <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                  <div>
                    <h2 className="font-semibold text-gray-900">Tickets requiring attention</h2>
                    <p className="mt-1 text-xs text-gray-500">
                      High-priority open and unassigned active tickets
                    </p>
                  </div>
                  <Link to="/agent/tickets" className="text-sm font-medium text-brand-700 hover:underline">
                    Support Desk
                  </Link>
                </div>
                {overview?.attentionTickets?.length ? (
                  <div className="space-y-2 p-4">
                    {overview.attentionTickets.map((ticket) => (
                      <TicketCard
                        key={ticket._id}
                        ticket={ticket}
                        href={`/agent/tickets/${ticket._id}`}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="px-5 py-8 text-sm text-gray-500">
                    No tickets currently need attention.
                  </p>
                )}
              </section>

              <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-5 py-4">
                  <h2 className="font-semibold text-gray-900">Recent support activity</h2>
                  <p className="mt-1 text-xs text-gray-500">Latest updates in this workspace</p>
                </div>
                {overview?.recentActivity?.length ? (
                  <ul className="divide-y divide-gray-100">
                    {overview.recentActivity.map((activity) => (
                      <li key={activity._id} className="px-5 py-4">
                        <Link
                          to={activity.ticket?._id
                            ? `/agent/tickets/${activity.ticket._id}`
                            : '/agent/tickets'}
                          className="text-sm font-medium text-gray-800 hover:text-brand-700"
                        >
                          {ACTIVITY_LABELS[activity.type] ?? 'Ticket updated'}
                          {activity.ticket?.title ? ` · ${activity.ticket.title}` : ''}
                        </Link>
                        <p className="mt-1 text-xs text-gray-500">
                          {activity.actor?.name ?? 'A team member'} ·{' '}
                          {new Date(activity.createdAt).toLocaleString()}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-8 text-sm text-gray-500">
                    Support activity will appear here as tickets are updated.
                  </p>
                )}
              </section>
            </div>

            <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-gray-900">Quick actions</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link to="/agent/tickets"><Button variant="secondary">Browse tickets</Button></Link>
                <Link to="/agent/portal"><Button variant="secondary">Companies & Workspaces</Button></Link>
                {isAdmin && (
                  <Link to="/agent/workspace/manage">
                    <Button variant="secondary">Invite or manage members</Button>
                  </Link>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
};

export default AgentDashboard;
