import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardAPI, usersAPI } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Card, Button, Badge, Spinner } from '../../components/ui/index.jsx';
import { formatCurrency, formatShortDate } from '../../utils/formatters.js';
import { CheckSquare, FileText, AlertCircle, TrendingUp } from 'lucide-react';

export default function AmbassadorDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [togglingAvail, setTogglingAvail] = useState(false);

  useEffect(() => {
    dashboardAPI.ambassador().then(setData).finally(() => setLoading(false));
  }, []);

  const handleAvailabilityToggle = async () => {
    if (!data || !user) return;
    setTogglingAvail(true);
    try {
      const res = await usersAPI.setAvailability(user.id, !data.isAvailable);
      setData((prev) => ({ ...prev, isAvailable: res.isAvailable }));
    } catch (err) {
      alert('Failed to update availability: ' + err.message);
    } finally {
      setTogglingAvail(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;
  if (!data) return null;

  const {
    upcomingShifts, lifetimeEarnings, currentPeriodEarnings, activeShift,
    shiftsNeedingReport, isAvailable, lifetimeSalesCount, commissionThisMonth,
  } = data;

  const atHighTier = lifetimeSalesCount >= 50;

  return (
    <div className="px-4 py-5 space-y-5 max-w-lg mx-auto">
      {/* Greeting + availability toggle */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Hey, {user?.firstName}!</h1>
          <p className="text-sm text-slate-500 mt-0.5">Here's your shift overview</p>
        </div>
        <button
          onClick={handleAvailabilityToggle}
          disabled={togglingAvail}
          className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
            isAvailable
              ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
          }`}
        >
          {togglingAvail ? '...' : isAvailable ? 'Available' : 'Unavailable'}
        </button>
      </div>

      {/* Active shift */}
      {activeShift && (
        <Card className="p-4 border-yellow-300 bg-yellow-50">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2.5 h-2.5 bg-yellow-400 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-yellow-800">Shift in Progress</span>
          </div>
          <div className="text-sm font-medium text-slate-800 mb-0.5">{activeShift.event.title}</div>
          <div className="text-xs text-slate-500 mb-3">{activeShift.event.location}</div>
          <Link to={`/checkin/${activeShift.id}`}>
            <Button className="w-full" variant="primary">Check Out</Button>
          </Link>
        </Card>
      )}

      {/* Reports needed */}
      {shiftsNeedingReport.length > 0 && (
        <Card className="p-4 border-orange-200 bg-orange-50">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={16} className="text-orange-500" />
            <span className="text-sm font-semibold text-orange-800">Report Due</span>
          </div>
          {shiftsNeedingReport.slice(0, 2).map((shift) => (
            <Link key={shift.id} to={`/report/${shift.id}`} className="block">
              <div className="text-sm text-slate-700 hover:text-mint-600">{shift.event.title} →</div>
            </Link>
          ))}
        </Card>
      )}

      {/* Earnings + Commission */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-xs text-slate-500 mb-1">This Month</div>
          <div className="text-2xl font-bold text-mint-600">{formatCurrency(currentPeriodEarnings)}</div>
          <div className="text-xs text-slate-400 mt-1">Hourly pay</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500 mb-1">Lifetime</div>
          <div className="text-2xl font-bold text-slate-800">{formatCurrency(lifetimeEarnings)}</div>
          <div className="text-xs text-slate-400 mt-1">Total earned</div>
        </Card>
      </div>

      {/* Commission card */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-mint-500" />
          <span className="text-sm font-semibold text-slate-700">Commission</span>
          <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${atHighTier ? 'bg-mint-100 text-mint-700' : 'bg-slate-100 text-slate-500'}`}>
            {atHighTier ? '$20/sale tier' : '$10/sale tier'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-mint-600">{formatCurrency(commissionThisMonth)}</div>
            <div className="text-xs text-slate-500 mt-0.5">This month</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-slate-800">{lifetimeSalesCount}</div>
            <div className="text-xs text-slate-500 mt-0.5">Lifetime sales</div>
          </div>
        </div>
        {!atHighTier && (
          <p className="text-xs text-slate-400 mt-2">
            {50 - lifetimeSalesCount} more sales to unlock $20/sale rate
          </p>
        )}
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/checkin">
          <Card className="p-4 flex flex-col items-center gap-2 text-center cursor-pointer hover:shadow-md transition-shadow border-mint-200">
            <CheckSquare size={22} className="text-mint-500" />
            <span className="text-sm font-medium text-slate-700">Check In</span>
            <span className="text-xs text-slate-400">Tap to punch in</span>
          </Card>
        </Link>
        <Link to="/report">
          <Card className="p-4 flex flex-col items-center gap-2 text-center cursor-pointer hover:shadow-md transition-shadow">
            <FileText size={22} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-700">Report</span>
            <span className="text-xs text-slate-400">Post-event form</span>
          </Card>
        </Link>
      </div>

      {/* Upcoming shifts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-800">Your Upcoming Shifts</h2>
          <Link to="/shifts" className="text-xs text-mint-600 hover:underline">View all</Link>
        </div>
        {upcomingShifts.length === 0 ? (
          <Card className="p-5 text-center">
            <p className="text-sm text-slate-500 mb-3">No upcoming shifts</p>
            <Link to="/shifts">
              <Button size="sm">Browse Open Shifts</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcomingShifts.map((shift) => (
              <Card key={shift.id} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-slate-800 truncate">{shift.event.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">{shift.event.location}</div>
                    <div className="text-xs text-mint-600 font-medium mt-1">{formatShortDate(shift.event.date)}</div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <Badge status={shift.status} />
                    {shift.status === 'ASSIGNED' && (
                      <Link to={`/checkin/${shift.id}`}>
                        <Button size="sm" variant="mint_outline">Check In</Button>
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
