import React from 'react';
import Badge from '../common/Badge.jsx';
import { statusConfig } from '../../utils/ticketHelpers.js';

const StatusBadge = ({ status }) => {
  const cfg = statusConfig[status] ?? { variant: 'gray', label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
};

export default StatusBadge;
