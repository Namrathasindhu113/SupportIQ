import React from 'react';

const sizeMap = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-[3px]',
};

/**
 * Spinner — accessible loading indicator.
 * @param {{ size?: 'sm' | 'md' | 'lg', className?: string }} props
 */
const Spinner = ({ size = 'md', className = '' }) => (
  <span
    role="status"
    aria-label="Loading"
    className={`inline-block rounded-full border-gray-200 border-t-brand-600 animate-spin ${sizeMap[size]} ${className}`}
  />
);

export default Spinner;
