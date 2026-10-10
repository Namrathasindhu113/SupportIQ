import React from 'react';

/**
 * StatCard — a single KPI tile shown on dashboards.
 * @param {{ label: string, value: number|string, colorClass?: string }} props
 */
const StatCard = ({ label, value, colorClass = 'text-gray-900' }) => (
  <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
    <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</p>
    <p className={`mt-1 text-3xl font-bold ${colorClass}`}>{value}</p>
  </div>
);

export default StatCard;
