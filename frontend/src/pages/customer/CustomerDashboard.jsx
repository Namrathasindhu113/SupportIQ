import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell.jsx';
import Button from '../../components/common/Button.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import ErrorMessage from '../../components/common/ErrorMessage.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import StatCard from '../../components/tickets/StatCard.jsx';
import TicketCard from '../../components/tickets/TicketCard.jsx';
import Pagination from '../../components/tickets/Pagination.jsx';
import useAuth from '../../hooks/useAuth.js';
import { getTicketsApi } from '../../api/ticketApi.js';

const CustomerDashboard = () => {
  const { user } = useAuth();

  const [data, setData]       = useState({ tickets: [], pagination: null });
  const [stats, setStats]     = useState({ total: 0, open: 0, inProgress: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [page, setPage]       = useState(1);

  const fetchTickets = async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getTicketsApi({ page: p, limit: 8 });
      setData(result);

      // Derive stats using the pagination.total already returned by each
      // filtered request.  limit:1 is the minimum valid value — we only need
      // the total count, not the actual ticket rows.
      if (p === 1) {
        const [openRes, inProgressRes, resolvedRes, closedRes] = await Promise.all([
          getTicketsApi({ status: 'open',        limit: 1 }),
          getTicketsApi({ status: 'in_progress', limit: 1 }),
          getTicketsApi({ status: 'resolved',    limit: 1 }),
          getTicketsApi({ status: 'closed',      limit: 1 }),
        ]);
        setStats({
          total:      result.pagination.total,
          open:       openRes.pagination.total,
          inProgress: inProgressRes.pagination.total,
          resolved:   resolvedRes.pagination.total + closedRes.pagination.total,
        });
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTickets(1); }, []);

  const handlePageChange = (p) => {
    setPage(p);
    fetchTickets(p);
  };

  return (
    <AppShell>
      <div className="px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Tickets</h1>
            <p className="mt-1 text-sm text-gray-500">
              Welcome back, <span className="font-medium">{user?.name}</span>.
            </p>
          </div>
          <Link to="/customer/tickets/new">
            <Button variant="primary">New Ticket</Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total"       value={stats.total}      />
          <StatCard label="Open"        value={stats.open}       colorClass="text-blue-600"   />
          <StatCard label="In Progress" value={stats.inProgress} colorClass="text-yellow-600" />
          <StatCard label="Resolved"    value={stats.resolved}   colorClass="text-green-600"  />
        </div>

        {/* Ticket list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <ErrorMessage error={error} className="mt-4" />
        ) : data.tickets.length === 0 ? (
          <EmptyState
            title="No tickets yet"
            description="Submit your first support request and our team will respond promptly."
            action={
              <Link to="/customer/tickets/new">
                <Button variant="primary">Create your first ticket</Button>
              </Link>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="divide-y divide-gray-100">
              {data.tickets.map((t) => (
                <div key={t._id} className="px-1 py-1">
                  <TicketCard ticket={t} href={`/customer/tickets/${t._id}`} />
                </div>
              ))}
            </div>
            <Pagination pagination={data.pagination} onPageChange={handlePageChange} />
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default CustomerDashboard;
