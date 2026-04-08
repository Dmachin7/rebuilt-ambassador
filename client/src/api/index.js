import { api } from './client.js';

// Auth
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
};

// Events
export const eventsAPI = {
  list: (status) => api.get(`/events${status ? `?status=${status}` : ''}`),
  get: (id) => api.get(`/events/${id}`),
  create: (data) => api.post('/events', data),
  update: (id, data) => api.put(`/events/${id}`, data),
  delete: (id) => api.delete(`/events/${id}`),
};

// Shifts
export const shiftsAPI = {
  list: () => api.get('/shifts'),
  listOpen: () => api.get('/shifts/open'),
  hours: () => api.get('/shifts/hours'),
  claim: (id) => api.post(`/shifts/${id}/claim`),
  assign: (id, ambassadorId) => api.post(`/shifts/${id}/assign`, { ambassadorId }),
  unassign: (id) => api.post(`/shifts/${id}/unassign`),
  checkin: (id, formData) => api.postForm(`/shifts/${id}/checkin`, formData),
  checkout: (id) => api.post(`/shifts/${id}/checkout`),
};

// Reports
export const reportsAPI = {
  list: (eventId) => api.get(`/reports${eventId ? `?eventId=${eventId}` : ''}`),
  mine: () => api.get('/reports/mine'),
  create: (data) => api.post('/reports', data),
};

// Payments
export const paymentsAPI = {
  list: (status) => api.get(`/payments${status ? `?status=${status}` : ''}`),
  updateStatus: (id, status) => api.put(`/payments/${id}/status`, { status }),
  exportCsv: () => api.downloadCsv('/payments/export/csv'),
  biweekly: (start, end) => {
    const params = [];
    if (start) params.push(`start=${start}`);
    if (end) params.push(`end=${end}`);
    return api.get(`/payments/biweekly${params.length ? `?${params.join('&')}` : ''}`);
  },
};

// Messages
export const messagesAPI = {
  list: (eventId) => api.get(`/messages/${eventId}`),
  send: (eventId, content) => api.post(`/messages/${eventId}`, { content }),
};

// Leaderboard
export const leaderboardAPI = {
  get: (month, year) => {
    const params = [];
    if (month) params.push(`month=${month}`);
    if (year) params.push(`year=${year}`);
    return api.get(`/leaderboard${params.length ? `?${params.join('&')}` : ''}`);
  },
};

// Dashboard
export const dashboardAPI = {
  admin: () => api.get('/dashboard/admin'),
  ambassador: () => api.get('/dashboard/ambassador'),
  sendAlert: (message) => api.post('/dashboard/alert', { message }),
  updateEventMetrics: (eventId, data) => api.patch(`/dashboard/events/${eventId}/metrics`, data),
};

// Users
export const usersAPI = {
  list: (role) => api.get(`/users${role ? `?role=${role}` : ''}`),
  get: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  create: (data) => api.post('/users', data),
  setAvailability: (id, isAvailable) => api.patch(`/users/${id}/availability`, { isAvailable }),
};

// Notifications
export const notificationsAPI = {
  triggerDaily: () => api.post('/notifications/daily'),
  triggerWeekly: () => api.post('/notifications/weekly'),
};
