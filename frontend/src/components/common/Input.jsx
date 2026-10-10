import React from 'react';

/**
 * Input — accessible labelled form field with optional error display.
 * @param {{
 *   label: string,
 *   id: string,
 *   error?: string,
 *   className?: string,
 * } & React.InputHTMLAttributes<HTMLInputElement>} props
 */
const Input = ({ label, id, error, className = '', ...rest }) => (
  <div className="flex flex-col gap-1">
    <label htmlFor={id} className="text-sm font-medium text-gray-700">
      {label}
    </label>
    <input
      id={id}
      aria-describedby={error ? `${id}-error` : undefined}
      aria-invalid={!!error}
      className={`
        block w-full rounded-lg border px-3 py-2 text-sm text-gray-900
        placeholder-gray-400 transition-colors
        ${
          error
            ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 bg-white focus:border-brand-500 focus:ring-brand-500'
        }
        focus:outline-none focus:ring-1
        disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500
        ${className}
      `}
      {...rest}
    />
    {error && (
      <p id={`${id}-error`} role="alert" className="text-xs text-red-600">
        {error}
      </p>
    )}
  </div>
);

export default Input;
