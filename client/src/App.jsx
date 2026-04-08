import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';

// Auth
import Login from './pages/auth/Login.jsx';

// Admin / Coordinator shared layout
import AdminLayout from './components/layout/AdminLayout.jsx';
import AdminDashboard from './pages/admin/Dashboard.jsx';
import AdminEvents from './pages/admin/Events.jsx';
import EventDetail from './pages/admin/EventDetail.jsx';
import AdminCalendar from './pages/admin/Calendar.jsx';
import AdminAmbassadors from './pages/admin/Ambassadors.jsx';
import AdminReports from './pages/admin/Reports.jsx';
import AdminPayroll from './pages/admin/Payroll.jsx';
import AdminMessages from './pages/admin/Messages.jsx';
import AdminLeaderboard from './pages/admin/Leaderboard.jsx';

// Ambassador
import AmbassadorLayout from './components/layout/AmbassadorLayout.jsx';
import AmbassadorDashboard from './pages/ambassador/Dashboard.jsx';
import AmbassadorShifts from './pages/ambassador/Shifts.jsx';
import CheckIn from './pages/ambassador/CheckIn.jsx';
import ReportForm from './pages/ambassador/Report.jsx';
import Earnings from './pages/ambassador/Earnings.jsx';
import AmbassadorLeaderboard from './pages/ambassador/Leaderboard.jsx';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="text-mint-500 text-lg">Loading...</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'AMBASSADOR') return <Navigate to="/dashboard" replace />;
    return <Navigate to="/admin/dashboard" replace />;
  }
  return children;
}

function AdminOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
  return children;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'AMBASSADOR') return <Navigate to="/dashboard" replace />;
  return <Navigate to="/admin/dashboard" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRedirect />} />

          {/* Admin + Event Coordinator routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'EVENT_COORDINATOR']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="events" element={<AdminEvents />} />
            <Route path="events/:id" element={<EventDetail />} />
            <Route path="calendar" element={<AdminCalendar />} />
            <Route path="ambassadors" element={<AdminAmbassadors />} />
            {/* Payroll and Reports — Admin only */}
            <Route path="reports" element={<AdminOnlyRoute><AdminReports /></AdminOnlyRoute>} />
            <Route path="payroll" element={<AdminOnlyRoute><AdminPayroll /></AdminOnlyRoute>} />
            <Route path="messages/:eventId" element={<AdminMessages />} />
            <Route path="messages" element={<AdminMessages />} />
            <Route path="leaderboard" element={<AdminLeaderboard />} />
          </Route>

          {/* Ambassador routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute allowedRoles={['AMBASSADOR']}>
                <AmbassadorLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<AmbassadorDashboard />} />
            <Route path="shifts" element={<AmbassadorShifts />} />
            <Route path="checkin/:shiftId" element={<CheckIn />} />
            <Route path="checkin" element={<CheckIn />} />
            <Route path="report/:shiftId" element={<ReportForm />} />
            <Route path="report" element={<ReportForm />} />
            <Route path="earnings" element={<Earnings />} />
            <Route path="leaderboard" element={<AmbassadorLeaderboard />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
