import React, { useState } from 'react';
import Button from '../common/Button.jsx';
import ErrorMessage from '../common/ErrorMessage.jsx';

/**
 * ReplyComposer — textarea + send button for ticket replies.
 * @param {{ onSend: (body:string) => Promise<void>, disabled?: boolean }} props
 */
const ReplyComposer = ({ onSend, disabled = false }) => {
  const [body, setBody]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      await onSend(trimmed);
      setBody('');
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <ErrorMessage error={error} />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={disabled || loading}
        placeholder="Write a reply…"
        rows={3}
        maxLength={5000}
        aria-label="Reply message"
        className="block w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{body.length}/5000</span>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={loading}
          disabled={disabled || !body.trim()}
        >
          Send reply
        </Button>
      </div>
    </form>
  );
};

export default ReplyComposer;
