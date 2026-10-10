import api from './axios.js';

// ── Ticket CRUD ───────────────────────────────────────────────────────────────

/** Customer: create a new ticket */
export const createTicketApi = (data) =>
  api.post('/tickets', data).then((r) => r.data.data.ticket);

/**
 * List tickets.
 * Customer: returns own tickets (backend filters by cookie identity).
 * Agent: returns all tickets.
 * @param {object} params - { status, priority, category, assignedTo, search, page, limit }
 */
export const getTicketsApi = (params = {}) =>
  api.get('/tickets', { params }).then((r) => r.data.data);

/** Company-scoped ticket metrics, attention list, and recent activity. */
export const getTicketOverviewApi = () =>
  api.get('/tickets/overview').then((r) => r.data.data);

/** Single ticket (detail only — no messages/activities) */
export const getTicketByIdApi = (id) =>
  api.get(`/tickets/${id}`).then((r) => r.data.data);

// ── Agent mutations ───────────────────────────────────────────────────────────

export const updateStatusApi = (id, status) =>
  api.patch(`/tickets/${id}/status`, { status }).then((r) => r.data.data.ticket);

export const updatePriorityApi = (id, priority) =>
  api.patch(`/tickets/${id}/priority`, { priority }).then((r) => r.data.data.ticket);

export const updateCategoryApi = (id, category) =>
  api.patch(`/tickets/${id}/category`, { category }).then((r) => r.data.data.ticket);

export const assignTicketApi = (id, assignedTo) =>
  api.patch(`/tickets/${id}/assign`, { assignedTo }).then((r) => r.data.data.ticket);

// ── Messages ──────────────────────────────────────────────────────────────────

export const getMessagesApi = (ticketId) =>
  api.get(`/tickets/${ticketId}/messages`).then((r) => r.data.data.messages);

export const sendMessageApi = (ticketId, body) =>
  api.post(`/tickets/${ticketId}/messages`, { body }).then((r) => r.data.data.message);

// ── Activity ──────────────────────────────────────────────────────────────────

export const getActivityApi = (ticketId) =>
  api.get(`/tickets/${ticketId}/activity`).then((r) => r.data.data.activities);

// ── Users ─────────────────────────────────────────────────────────────────────

export const getAgentsApi = () =>
  api.get('/users/agents').then((r) => r.data.data.agents);

// ── AI Analysis ───────────────────────────────────────────────────────────────

/** Get existing AI analysis for a ticket */
export const getAIAnalysisApi = (ticketId) =>
  api.get(`/tickets/${ticketId}/ai/analyze`).then((r) => r.data);

/** Generate new AI analysis for a ticket */
export const generateAIAnalysisApi = (ticketId) =>
  api.post(`/tickets/${ticketId}/ai/analyze`).then((r) => r.data);
