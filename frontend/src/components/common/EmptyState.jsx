import React from 'react';

/**
 * EmptyState — shown when a list or page has no content to display.
 * @param {{ icon?: React.ReactNode, title: string, description?: string, action?: React.ReactNode }} props
 */
const EmptyState = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
    {icon && (
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        {icon}
      </div>
    )}
    <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
    {description && (
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
