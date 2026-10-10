import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import ErrorMessage from '../../components/common/ErrorMessage.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import StatusBadge from '../../components/tickets/StatusBadge.jsx';
import PriorityBadge from '../../components/tickets/PriorityBadge.jsx';
import TicketFilters from '../../components/tickets/TicketFilters.jsx';
import Pagination from '../../components/tickets/Pagination.jsx';
import { getTicketsApi, getAgentsApi } from '../../api/ticketApi.js';
import { categoryConfig } from '../../utils/ticketHelpers.js';
import { formatDate as fmtDate } from '../../utils/formatDate.js';

const EMPTY_FILTERS = { search: '', status: '', priority: '', category: '', assignedTo: '' };

const AgentTicketList = () => {
  const [tickets, setTickets]     = useState([]);
  const [pagination, setPagination] = useState(null);
  const [agents, setAgents]       = useState([]);
  const [filters, setFilters]     = useState(EMPTY_FILTERS);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  // Debounce search so we don't fire on every keystroke
  const searchTimer = useRef(null);

  const fetchTickets = useCallback(async (f, p) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page: p, limit: 10 };
      if (f.search)     params.search     = f.search;
      if (f.status)     params.status     = f.status;
      if (f.priority)   params.priority   = f.priority;
      if (f.category)   params.category   = f.category;
      if (f.assignedTo) params.assignedTo = f.assignedTo;
      const result = await getTicketsApi(params);
      setTickets(result.tickets);
      setPagination(result.pagination);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load agents once
  useEffect(() => {
    getAgentsApi().then(setAgents).catch(() => {});
  }, []);

  // Fetch whenever page changes
  useEffect(() => { fetchTickets(filters, page); }, [page]); // eslint-disable-line

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    // Debounce only search; apply other filters immediately
    if (key === 'search') {
      clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => { setPage(1); fetchTickets(newFilters, 1); }, 400);
    } else {
      setPage(1);
      fetchTickets(newFilters, 1);
    }
  };

  const handleClearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
    fetchTickets(EMPTY_FILTERS, 1);
  };

  const handlePageChange = (p) => setPage(p);

  return (
    <AppShell>
      <div className="px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
          <p className="mt-1 text-sm text-gray-500">
            {pagination ? `${pagination.total} total tickets` : 'Loading…'}
          </p>
        </div>

        {/* Filters */}
        <div className="mb-5">
          <TicketFilters
            filters={filters}
            agents={agents}
            onChange={handleFilterChange}
            onClear={handleClearFilters}
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : error ? (
          <ErrorMessage error={error} />
        ) : tickets.length === 0 ? (
          <EmptyState
            title="No tickets found"
            description="Try adjusting your search or filters."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {/* Responsive table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Ticket', 'Customer', 'Status', 'Priority', 'Category', 'Assigned To', 'Created', ''].map((h) => (
                      <th key={h} scope="col"
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {tickets.map((t) => (
                    <tr key={t._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 max-w-[220px]">
                        <p className="truncate font-medium text-gray-900">{t.title}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {t.customer?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 capitalize">
                        {categoryConfig[t.category]?.label ?? t.category}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {t.assignedTo?.name ?? <span className="italic text-gray-400">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                        {fmtDate(t.createdAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          to={`/agent/tickets/${t._id}`}
                          className="text-brand-600 hover:underline font-medium"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={pagination} onPageChange={handlePageChange} />
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default AgentTicketList;
