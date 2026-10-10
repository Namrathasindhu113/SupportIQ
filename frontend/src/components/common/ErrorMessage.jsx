import React from 'react';

/**
 * ErrorMessage — displays a prominent error alert.
 * Extracts a human-readable message from an Axios error or plain string.
 *
 * @param {{ error: unknown, className?: string }} props
 */
const ErrorMessage = ({ error, className = '' }) => {
  if (!error) return null;

  const message =
    // Axios error with backend { message } body
    error?.response?.data?.message ||
    // Plain error object
    error?.message ||
    // String passed directly
    (typeof error === 'string' ? error : 'An unexpected error occurred.');

  return (
    <div
      role="alert"
      className={`rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 ${className}`}
    >
      {message}
    </div>
  );
};

export default ErrorMessage;
