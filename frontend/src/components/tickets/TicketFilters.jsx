import React from 'react';
import { STATUS_OPTIONS, PRIORITY_OPTIONS, CATEGORY_OPTIONS } from '../../utils/ticketHelpers.js';

/**
 * TicketFilters — filter bar for the agent ticket queue.
 * @param {{ filters: object, agents: array, onChange: (key,val)=>void, onClear: ()=>void }} props
 */
const TicketFilters = ({ filters, agents = [], onChange, onClear }) => {
  const selectCls =
    'rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

  const hasFilters = filters.status || filters.priority || filters.category || filters.assignedTo || filters.search;

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Search */}
      <div className="flex-1 min-w-[200px]">
        <input
          type="search"
          placeholder="Search tickets…"
          value={filters.search ?? ''}
          onChange={(e) => onChange('search', e.target.value)}
          className={selectCls + ' w-full'}
          aria-label="Search tickets"
        />
      </div>

      {/* Status */}
      <select
        value={filters.status ?? ''}
        onChange={(e) => onChange('status', e.target.value)}
        className={selectCls}
        aria-label="Filter by status"
      >
        <option value="">All statuses</option>
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Priority */}
      <select
        value={filters.priority ?? ''}
        onChange={(e) => onChange('priority', e.target.value)}
        className={selectCls}
        aria-label="Filter by priority"
      >
        <option value="">All priorities</option>
        {PRIORITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Category */}
      <select
        value={filters.category ?? ''}
        onChange={(e) => onChange('category', e.target.value)}
        className={selectCls}
        aria-label="Filter by category"
      >
        <option value="">All categories</option>
        {CATEGORY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Assigned to */}
      {agents.length > 0 && (
        <select
          value={filters.assignedTo ?? ''}
          onChange={(e) => onChange('assignedTo', e.target.value)}
          className={selectCls}
          aria-label="Filter by assigned agent"
        >
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a._id} value={a._id}>{a.name}</option>
          ))}
        </select>
      )}

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={onClear}
          className="text-sm text-brand-600 hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
};

export default TicketFilters;
