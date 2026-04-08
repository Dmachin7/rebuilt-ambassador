import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { CalendarDays, CheckSquare, FileText, DollarSign, Trophy, LogOut } from 'lucide-react';

const bottomNav = [
  { to: '/shifts',      icon: CalendarDays, label: 'Shifts' },
  { to: '/checkin',     icon: CheckSquare,  label: 'Check-In' },
  { to: '/report',      icon: FileText,     label: 'Report' },
  { to: '/earnings',    icon: DollarSign,   label: 'Earnings' },
  { to: '/leaderboard', icon: Trophy,       label: 'Rankings' },
];

export default function AmbassadorLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-20">
      {/* Mobile top header */}
      <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-mint-300 rounded-lg flex items-center justify-center font-bold text-slate-800 text-xs">R</div>
          <span className="font-semibold text-slate-800 text-sm">ReBuilt</span>
        </div>
        <div className="flex items-center gap-3">
          <NavLink to="/dashboard" className="text-xs text-slate-500 hover:text-slate-800 hidden sm:block">
            Hi, {user?.firstName}
          </NavLink>
          <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 transition-colors">
            <LogOut size={17} />
          </button>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-30 safe-area-bottom">
        <div className="flex">
          {bottomNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-2.5 text-xs transition-colors ${
                  isActive ? 'text-mint-600 font-medium' : 'text-slate-400 hover:text-slate-600'
                }`
              }
            >
              <Icon size={20} className="mb-0.5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
