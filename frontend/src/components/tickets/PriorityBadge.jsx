import React from 'react';
import Badge from '../common/Badge.jsx';
import { priorityConfig } from '../../utils/ticketHelpers.js';

const PriorityBadge = ({ priority }) => {
  const cfg = priorityConfig[priority] ?? { variant: 'gray', label: priority };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
};

export default PriorityBadge;
