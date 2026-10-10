/**
 * Maps ticket status → Badge variant and label.
 * Variants are those already defined in Badge.jsx:
 * gray | blue | green | yellow | red | purple | orange
 */
export const statusConfig = {
  open:        { variant: 'blue',   label: 'Open' },
  in_progress: { variant: 'yellow', label: 'In Progress' },
  resolved:    { variant: 'green',  label: 'Resolved' },
  closed:      { variant: 'gray',   label: 'Closed' },
};

export const priorityConfig = {
  low:    { variant: 'gray',   label: 'Low' },
  medium: { variant: 'blue',   label: 'Medium' },
  high:   { variant: 'orange', label: 'High' },
  urgent: { variant: 'red',    label: 'Urgent' },
};

export const categoryConfig = {
  billing:   { label: 'Billing' },
  technical: { label: 'Technical' },
  general:   { label: 'General' },
  other:     { label: 'Other' },
};

export const STATUS_OPTIONS   = Object.entries(statusConfig).map(([v, c]) => ({ value: v, label: c.label }));
export const PRIORITY_OPTIONS = Object.entries(priorityConfig).map(([v, c]) => ({ value: v, label: c.label }));
export const CATEGORY_OPTIONS = Object.entries(categoryConfig).map(([v, c]) => ({ value: v, label: c.label }));

/** Activity type → human readable sentence */
export const activityLabel = (activity) => {
  const { type, meta, actor } = activity;
  const name = actor?.name ?? 'Someone';
  switch (type) {
    case 'ticket_created':   return `${name} opened this ticket`;
    case 'status_changed':   return `${name} changed status from "${meta?.from}" to "${meta?.to}"`;
    case 'priority_changed': return `${name} changed priority from "${meta?.from}" to "${meta?.to}"`;
    case 'category_changed': return `${name} changed category from "${meta?.from}" to "${meta?.to}"`;
    case 'assigned':         return `${name} assigned ticket to ${meta?.agentName ?? 'an agent'}`;
    case 'unassigned':       return `${name} unassigned the ticket`;
    case 'replied':          return `${name} replied`;
    case 'ai_analyzed':      return `${name} ran AI analysis`;
    default:                 return type;
  }
};
