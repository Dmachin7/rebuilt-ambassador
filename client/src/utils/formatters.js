import { format, formatDistance, isToday, isTomorrow, isPast } from 'date-fns';

export const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);

export const formatHours = (hours) => {
  if (!hours) return '0h';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

export const formatDate = (date) => format(new Date(date), 'MMM d, yyyy');

export const formatDateTime = (date) => format(new Date(date), 'MMM d, yyyy h:mm a');

export const formatTime = (date) => format(new Date(date), 'h:mm a');

export const formatShortDate = (date) => {
  const d = new Date(date);
  if (isToday(d)) return `Today at ${formatTime(d)}`;
  if (isTomorrow(d)) return `Tomorrow at ${formatTime(d)}`;
  return format(d, 'EEE, MMM d') + ` at ${formatTime(d)}`;
};

export const formatRelative = (date) =>
  formatDistance(new Date(date), new Date(), { addSuffix: true });

export const isShiftPast = (shift) =>
  shift.event?.date ? isPast(new Date(shift.event.date)) : false;

export const statusLabel = (status) => {
  const labels = {
    UPCOMING: 'Upcoming',
    ACTIVE: 'Active',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    OPEN: 'Open',
    ASSIGNED: 'Assigned',
    CHECKED_IN: 'Checked In',
    PENDING: 'Pending',
    APPROVED: 'Approved',
    PAID: 'Paid',
  };
  return labels[status] || status;
};

export const statusClass = (status) => {
  const classes = {
    UPCOMING: 'badge-upcoming',
    ACTIVE: 'badge-active',
    COMPLETED: 'badge-completed',
    CANCELLED: 'badge-cancelled',
    OPEN: 'badge-open',
    ASSIGNED: 'badge-assigned',
    CHECKED_IN: 'badge-checked_in',
    PENDING: 'badge-pending',
    APPROVED: 'badge-approved',
    PAID: 'badge-paid',
  };
  return classes[status] || 'badge-completed';
};

export const eventColor = (status) => {
  const colors = {
    UPCOMING: '#A8E6CF',
    ACTIVE: '#FCD34D',
    COMPLETED: '#CBD5E1',
    CANCELLED: '#FCA5A5',
  };
  return colors[status] || '#A8E6CF';
};
