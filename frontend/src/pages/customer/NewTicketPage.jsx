import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell.jsx';
import Button from '../../components/common/Button.jsx';
import Input from '../../components/common/Input.jsx';
import ErrorMessage from '../../components/common/ErrorMessage.jsx';
import { createTicketApi } from '../../api/ticketApi.js';
import { PRIORITY_OPTIONS, CATEGORY_OPTIONS } from '../../utils/ticketHelpers.js';

const NewTicketPage = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'general',
    priority: 'medium',
  });
  const [errors, setErrors]   = useState({});
  const [apiError, setApiError] = useState(null);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.title.trim())          e.title       = 'Title is required.';
    else if (form.title.length > 150) e.title      = 'Title cannot exceed 150 characters.';
    if (!form.description.trim())    e.description = 'Description is required.';
    else if (form.description.length > 3000) e.description = 'Description cannot exceed 3000 characters.';
    return e;
  };

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors((p) => ({ ...p, [e.target.name]: '' }));
    setApiError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length) { setErrors(fieldErrors); return; }
    setLoading(true);
    setApiError(null);
    try {
      const ticket = await createTicketApi({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        priority: form.priority,
        // customer / status / assignedTo intentionally omitted — backend sets them
      });
      navigate(`/customer/tickets/${ticket._id}`, { replace: true });
    } catch (err) {
      setApiError(err);
    } finally {
      setLoading(false);
    }
  };

  const selectCls = (hasError) =>
    `block w-full rounded-lg border px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1
     ${hasError ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 bg-white focus:border-brand-500 focus:ring-brand-500'}`;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Create Support Ticket</h1>
          <p className="mt-1 text-sm text-gray-500">
            Describe your issue and our team will get back to you.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <ErrorMessage error={apiError} className="mb-5" />

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <Input
              id="title"
              name="title"
              type="text"
              label="Subject"
              placeholder="Briefly describe your issue"
              value={form.title}
              onChange={handleChange}
              error={errors.title}
              disabled={loading}
              maxLength={150}
            />

            {/* Description */}
            <div className="flex flex-col gap-1">
              <label htmlFor="description" className="text-sm font-medium text-gray-700">
                Description <span className="text-gray-400">(required)</span>
              </label>
              <textarea
                id="description"
                name="description"
                rows={6}
                value={form.description}
                onChange={handleChange}
                disabled={loading}
                placeholder="Provide as much detail as possible — steps to reproduce, error messages, screenshots…"
                maxLength={3000}
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? 'description-error' : undefined}
                className={`resize-y ${selectCls(errors.description)}`}
              />
              <div className="flex justify-between">
                {errors.description
                  ? <p id="description-error" role="alert" className="text-xs text-red-600">{errors.description}</p>
                  : <span />}
                <span className="text-xs text-gray-400">{form.description.length}/3000</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Category */}
              <div className="flex flex-col gap-1">
                <label htmlFor="category" className="text-sm font-medium text-gray-700">Category</label>
                <select
                  id="category"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  disabled={loading}
                  className={selectCls(false)}
                >
                  {CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div className="flex flex-col gap-1">
                <label htmlFor="priority" className="text-sm font-medium text-gray-700">Priority</label>
                <select
                  id="priority"
                  name="priority"
                  value={form.priority}
                  onChange={handleChange}
                  disabled={loading}
                  className={selectCls(false)}
                >
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => navigate('/customer/dashboard')} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={loading}>
                {loading ? 'Submitting…' : 'Submit ticket'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
};

export default NewTicketPage;
