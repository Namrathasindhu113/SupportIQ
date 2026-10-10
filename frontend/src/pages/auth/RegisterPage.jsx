import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth.js';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import ErrorMessage from '../../components/common/ErrorMessage.jsx';

/**
 * RegisterPage — /register
 *
 * Public registration always creates a customer account.
 * The backend enforces this — role is not sent in the request.
 */
const RegisterPage = () => {
  const { register } = useAuth();
  const navigate     = useNavigate();
  const location     = useLocation();
  const from         = location.state?.from ?? null;

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors]     = useState({});
  const [apiError, setApiError] = useState(null);
  const [loading, setLoading]   = useState(false);

  const validate = () => {
    const e = {};
    if (!form.name.trim())
      e.name = 'Name is required.';
    if (!form.email.trim())
      e.email = 'Email is required.';
    else if (!/^\S+@\S+\.\S+$/.test(form.email))
      e.email = 'Enter a valid email address.';
    if (!form.password)
      e.password = 'Password is required.';
    else if (form.password.length < 6)
      e.password = 'Password must be at least 6 characters.';
    if (!form.confirmPassword)
      e.confirmPassword = 'Please confirm your password.';
    else if (form.password !== form.confirmPassword)
      e.confirmPassword = 'Passwords do not match.';
    return e;
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) {
      setErrors((prev) => ({ ...prev, [e.target.name]: '' }));
    }
    setApiError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    setApiError(null);

    try {
      // confirmPassword is not sent to the backend
      await register(form.name.trim(), form.email.trim(), form.password);
      // Preserve invitation links through account creation.
      navigate(from ? `${from.pathname}${from.search ?? ''}` : '/', { replace: true });
    } catch (err) {
      setApiError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
          <p className="mt-1 text-sm text-gray-500">Start submitting support tickets</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <ErrorMessage error={apiError} className="mb-5" />

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Input
              id="name"
              name="name"
              type="text"
              label="Full name"
              placeholder="Jane Smith"
              autoComplete="name"
              value={form.name}
              onChange={handleChange}
              error={errors.name}
              disabled={loading}
            />

            <Input
              id="email"
              name="email"
              type="email"
              label="Email address"
              placeholder="you@example.com"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              error={errors.email}
              disabled={loading}
            />

            <Input
              id="password"
              name="password"
              type="password"
              label="Password"
              placeholder="At least 6 characters"
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange}
              error={errors.password}
              disabled={loading}
            />

            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              label="Confirm password"
              placeholder="Repeat password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
              disabled={loading}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="mt-2 w-full"
            >
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
        </div>

        {/* Login link */}
        <p className="mt-5 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link
            to="/login"
            state={from ? { from } : undefined}
            className="font-medium text-brand-600 hover:text-brand-700 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
