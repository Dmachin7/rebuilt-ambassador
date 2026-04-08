import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardAPI, eventsAPI } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Card, StatCard, Badge, Button, Spinner, EmptyState } from '../../components/ui/index.jsx';
import { formatCurrency, formatShortDate, formatHours } from '../../utils/formatters.js';
import { Calendar, Users, AlertTriangle, DollarSign, Zap, Bell } from 'lucide-react';

function EventMetricsPanel({ event, onSave }) {
  const [mealsSold, setMealsSold] = useState(event.totalMealsSold ?? '');
  const [totalSales, setTotalSales] = useState(event.totalSalesInput ?? '');
  const [saving, setSaving] = useState(false);

  const avgMeals =
    mealsSold && totalSales && parseInt(totalSales) > 0
      ? (parseInt(mealsSold) / parseInt(totalSales)).toFixed(1)
      : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await dashboardAPI.updateEventMetrics(event.id, {
        totalMealsSold: parseInt(mealsSold) || 0,
        totalSalesInput: parseInt(totalSales) || 0,
      });
      onSave(event.id, { totalMealsSold: parseInt(mealsSold) || 0, totalSalesInput: parseInt(totalSales) || 0 });
    } catch (err) {
      alert('Failed to save metrics: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <p className="text-xs font-medium text-slate-500 mb-2">Admin Metrics Input</p>
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-xs text-slate-400">Meals Sold</label>
          <input
            type="number" min="0" value={mealsSold}
            onChange={(e) => setMealsSold(e.target.value)}
            className="input-field text-xs py-1.5 mt-0.5"
            placeholder="0"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-slate-400">Total Sales</label>
          <input
            type="number" min="0" value={totalSales}
            onChange={(e) => setTotalSales(e.target.value)}
            className="input-field text-xs py-1.5 mt-0.5"
            placeholder="0"
          />
        </div>
        {avgMeals && (
          <div className="text-center pb-1.5">
            <div className="text-sm font-bold text-mint-600">{avgMeals}</div>
            <div className="text-xs text-slate-400">avg/sale</div>
          </div>
        )}
        <Button size="sm" onClick={handleSave} disabled={saving} className="mb-0.5">
          {saving ? '...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alertMsg, setAlertMsg] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    dashboardAPI.admin().then(setData).finally(() => setLoading(false));
  }, []);

  const handleAlert = async () => {
    if (!alertMsg.trim()) return;
    setSending(true);
    try {
      const res = await dashboardAPI.sendAlert(alertMsg);
      alert(`Alert sent to ${res.notified} ambassadors (logged to console — Twilio not yet wired)`);
      setAlertMsg('');
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleMetricsSave = (eventId, metrics) => {
    setData((prev) => ({
      ...prev,
      upcomingEvents: prev.upcomingEvents.map((e) =>
        e.id === eventId ? { ...e, ...metrics } : e
      ),
    }));
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;
  if (!data) return null;

  const { eventCounts, upcomingEvents, openShifts, pendingPayments, ambassadorStats } = data;
  const totalEvents = Object.values(eventCounts).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Welcome back — here's what's happening</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Events" value={totalEvents} sub={`${eventCounts.UPCOMING || 0} upcoming`} icon={<Zap size={16} />} color="mint" />
        <StatCard label="Open Shifts" value={openShifts.length} sub="need ambassadors" icon={<Calendar size={16} />} color="orange" />
        {isAdmin && (
          <StatCard label="Pending Payouts" value={pendingPayments.length} sub={formatCurrency(pendingPayments.reduce((s, p) => s + p.amount, 0))} icon={<DollarSign size={16} />} color="blue" />
        )}
        <StatCard label="Ambassadors" value={ambassadorStats.length} sub="active team" icon={<Users size={16} />} color="green" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Upcoming events */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Upcoming Events (Next 7 Days)</h2>
            <Link to="/admin/events" className="text-sm text-mint-600 hover:underline">View all</Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <Card className="p-6">
              <EmptyState icon="📅" title="No events this week" description="Create an event to get started" action={<Link to="/admin/events"><Button size="sm">Create Event</Button></Link>} />
            </Card>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((event) => {
                const assigned = event.shifts.filter((s) => s.ambassadorId).length;
                const total = event.shifts.length;
                return (
                  <Card key={event.id} className="p-4 hover:shadow-md transition-shadow">
                    <Link to={`/admin/events/${event.id}`} className="block">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-800 text-sm truncate">{event.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5 truncate">{event.location}</div>
                          <div className="text-xs text-mint-600 mt-1 font-medium">{formatShortDate(event.date)}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-xs font-medium ${assigned < total ? 'text-orange-600' : 'text-green-600'}`}>
                            {assigned}/{total} filled
                          </div>
                          <Badge status={event.status} />
                        </div>
                      </div>
                    </Link>
                    {isAdmin && (
                      <EventMetricsPanel event={event} onSave={handleMetricsSave} />
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Open shifts alert */}
          {openShifts.length > 0 && (
            <Card>
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <AlertTriangle size={15} className="text-orange-500" />
                <span className="font-medium text-sm text-slate-800">Open Shifts ({openShifts.length})</span>
              </div>
              <div className="divide-y divide-slate-50">
                {openShifts.slice(0, 4).map((shift) => (
                  <div key={shift.id} className="px-4 py-2.5">
                    <div className="text-xs font-medium text-slate-700 truncate">{shift.event.title}</div>
                    <div className="text-xs text-slate-400">{formatShortDate(shift.event.date)}</div>
                  </div>
                ))}
              </div>
              {openShifts.length > 4 && (
                <div className="px-4 py-2 text-xs text-slate-400">+{openShifts.length - 4} more</div>
              )}
            </Card>
          )}

          {/* Pending payments — admin only */}
          {isAdmin && pendingPayments.length > 0 && (
            <Card>
              <div className="px-4 py-3 border-b border-slate-100">
                <span className="font-medium text-sm text-slate-800">Pending Payments</span>
              </div>
              <div className="divide-y divide-slate-50">
                {pendingPayments.slice(0, 3).map((p) => (
                  <div key={p.id} className="px-4 py-2.5 flex justify-between items-center">
                    <div>
                      <div className="text-xs font-medium text-slate-700">{p.ambassador.firstName} {p.ambassador.lastName}</div>
                      <div className="text-xs text-slate-400">{p.shift.event.title}</div>
                    </div>
                    <div className="text-xs font-semibold text-slate-800">{formatCurrency(p.amount)}</div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2">
                <Link to="/admin/payroll" className="text-xs text-mint-600 hover:underline">Manage payroll →</Link>
              </div>
            </Card>
          )}

          {/* Urgent alert — admin only */}
          {isAdmin && (
            <Card>
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <Bell size={15} className="text-mint-600" />
                <span className="font-medium text-sm text-slate-800">Send Alert</span>
              </div>
              <div className="px-4 py-3 space-y-2">
                <textarea
                  value={alertMsg}
                  onChange={(e) => setAlertMsg(e.target.value)}
                  placeholder="Urgent message to all ambassadors..."
                  className="input-field text-xs resize-none h-20"
                />
                <Button onClick={handleAlert} disabled={sending || !alertMsg.trim()} className="w-full" size="sm">
                  {sending ? 'Sending...' : '📢 Broadcast Alert'}
                </Button>
                <p className="text-xs text-slate-400">Stub: logs to console (Twilio not yet wired)</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Ambassador performance */}
      <div>
        <h2 className="font-semibold text-slate-800 mb-3">Ambassador Performance</h2>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Ambassador</th>
                  <th className="px-4 py-3 text-center">Available</th>
                  <th className="px-4 py-3 text-right">Shifts</th>
                  <th className="px-4 py-3 text-right">Hours</th>
                  {isAdmin && <th className="px-4 py-3 text-right">Earnings</th>}
                  <th className="px-4 py-3 text-right">Meals Sold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ambassadorStats.sort((a, b) => b.shiftsWorked - a.shiftsWorked).map((amb) => (
                  <tr key={amb.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-mint-100 rounded-full flex items-center justify-center text-xs font-medium text-mint-700">
                          {amb.firstName[0]}{amb.lastName[0]}
                        </div>
                        <span className="font-medium text-slate-700">{amb.firstName} {amb.lastName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${amb.isAvailable ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {amb.isAvailable ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{amb.shiftsWorked}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatHours(amb.totalHours)}</td>
                    {isAdmin && <td className="px-4 py-3 text-right font-medium text-slate-800">{formatCurrency(amb.totalEarnings)}</td>}
                    <td className="px-4 py-3 text-right text-slate-600">{amb.totalMealsSold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
