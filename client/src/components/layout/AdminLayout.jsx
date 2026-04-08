import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  LayoutDashboard, Calendar, Users, FileText, DollarSign,
  Trophy, MessageSquare, LogOut, Menu, Zap,
} from 'lucide-react';

const ALL_NAV = [
  { to: '/admin/dashboard',    icon: LayoutDashboard, label: 'Dashboard',    roles: ['ADMIN', 'EVENT_COORDINATOR'] },
  { to: '/admin/events',       icon: Zap,             label: 'Events',       roles: ['ADMIN', 'EVENT_COORDINATOR'] },
  { to: '/admin/calendar',     icon: Calendar,        label: 'Calendar',     roles: ['ADMIN', 'EVENT_COORDINATOR'] },
  { to: '/admin/ambassadors',  icon: Users,           label: 'Ambassadors',  roles: ['ADMIN', 'EVENT_COORDINATOR'] },
  { to: '/admin/reports',      icon: FileText,        label: 'Reports',      roles: ['ADMIN'] },
  { to: '/admin/payroll',      icon: DollarSign,      label: 'Payroll',      roles: ['ADMIN'] },
  { to: '/admin/messages',     icon: MessageSquare,   label: 'Messages',     roles: ['ADMIN', 'EVENT_COORDINATOR'] },
  { to: '/admin/leaderboard',  icon: Trophy,          label: 'Leaderboard',  roles: ['ADMIN', 'EVENT_COORDINATOR'] },
];

const ROLE_LABELS = {
  ADMIN: 'Admin Portal',
  EVENT_COORDINATOR: 'Coordinator Portal',
};

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = ALL_NAV.filter((item) => item.roles.includes(user?.role));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-mint-300 rounded-lg flex items-center justify-center font-bold text-slate-800 text-sm">R</div>
          <div>
            <div className="font-bold text-slate-800 text-sm">ReBuilt</div>
            <div className="text-xs text-slate-400">{ROLE_LABELS[user?.role] || 'Portal'}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-mint-100 text-mint-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-slate-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-mint-200 rounded-full flex items-center justify-center text-sm font-medium text-mint-700">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-800 truncate">{user?.firstName} {user?.lastName}</div>
            <div className="text-xs text-slate-400 truncate">{user?.role === 'EVENT_COORDINATOR' ? 'Event Coordinator' : 'Admin'}</div>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-slate-500 hover:text-red-500 transition-colors">
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-white border-r border-slate-100 fixed h-full z-20">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-56 h-full bg-white shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-56 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="text-slate-600">
              <Menu size={22} />
            </button>
            <div className="font-semibold text-slate-800 text-sm">ReBuilt {user?.role === 'EVENT_COORDINATOR' ? 'Coordinator' : 'Admin'}</div>
          </div>
          <div className="w-8 h-8 bg-mint-200 rounded-full flex items-center justify-center text-xs font-medium text-mint-700">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
