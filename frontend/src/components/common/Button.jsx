import React from 'react';
import Spinner from './Spinner.jsx';

const variantMap = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-500 disabled:bg-brand-300',
  secondary:
    'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus-visible:ring-brand-500 disabled:opacity-50',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 disabled:bg-red-300',
  ghost:
    'bg-transparent text-gray-600 hover:bg-gray-100 focus-visible:ring-brand-500 disabled:opacity-40',
};

const sizeMap = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

/**
 * Button — reusable accessible button.
 * @param {{
 *   variant?: 'primary'|'secondary'|'danger'|'ghost',
 *   size?: 'sm'|'md'|'lg',
 *   loading?: boolean,
 *   children: React.ReactNode,
 *   className?: string,
 * } & React.ButtonHTMLAttributes<HTMLButtonElement>} props
 */
const Button = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...rest
}) => (
  <button
    disabled={disabled || loading}
    className={`
      inline-flex items-center justify-center gap-2
      rounded-lg font-medium transition-colors
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
      disabled:cursor-not-allowed
      ${variantMap[variant]}
      ${sizeMap[size]}
      ${className}
    `}
    {...rest}
  >
    {loading && <Spinner size="sm" />}
    {children}
  </button>
);

export default Button;
