import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { shiftsAPI } from '../../api/index.js';
import { Card, Button, Badge, Spinner, EmptyState } from '../../components/ui/index.jsx';
import { formatShortDate, formatHours } from '../../utils/formatters.js';
import { MapPin, Clock, Users } from 'lucide-react';

export default function AmbassadorShifts() {
  const [myShifts, setMyShifts] = useState([]);
  const [openShifts, setOpenShifts] = useState([]);
  const [tab, setTab] = useState('mine');
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(null);

  const load = async () => {
    const [mine, open] = await Promise.all([shiftsAPI.list(), shiftsAPI.listOpen()]);
    setMyShifts(mine);
    setOpenShifts(open);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleClaim = async (shiftId) => {
    setClaiming(shiftId);
    try {
      await shiftsAPI.claim(shiftId);
      await load();
      setTab('mine');
    } catch (err) {
      alert(err.message);
    } finally {
      setClaiming(null);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;

  const upcoming = myShifts.filter((s) => ['ASSIGNED', 'CHECKED_IN'].includes(s.status));
  const past = myShifts.filter((s) => s.status === 'COMPLETED');

  return (
    <div className="px-4 py-5 space-y-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-slate-800">Shifts</h1>

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-lg p-1">
        <button onClick={() => setTab('mine')} className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'mine' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
          My Shifts {upcoming.length > 0 && <span className="ml-1 bg-mint-300 text-slate-800 text-xs px-1.5 rounded-full">{upcoming.length}</span>}
        </button>
        <button onClick={() => setTab('open')} className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'open' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
          Open Shifts {openShifts.length > 0 && <span className="ml-1 bg-orange-200 text-orange-700 text-xs px-1.5 rounded-full">{openShifts.length}</span>}
        </button>
      </div>

      {tab === 'mine' ? (
        <div className="space-y-5">
          {upcoming.length === 0 && past.length === 0 ? (
            <Card className="p-6">
              <EmptyState icon="📅" title="No shifts yet" description="Check the open shifts tab to claim a shift" action={<Button onClick={() => setTab('open')} size="sm">Browse Open Shifts</Button>} />
            </Card>
          ) : (
            <>
              {upcoming.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Upcoming</h2>
                  {upcoming.map((shift) => (
                    <Card key={shift.id} className="p-4">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div className="font-medium text-slate-800 text-sm">{shift.event.title}</div>
                        <Badge status={shift.status} />
                      </div>
                      <div className="space-y-1 text-xs text-slate-500">
                        <div className="flex items-start gap-1.5"><MapPin size={11} className="mt-0.5 shrink-0" /><span className="truncate">{shift.event.location}</span></div>
                        <div className="flex items-center gap-1.5"><Clock size={11} /><span className="text-mint-600 font-medium">{formatShortDate(shift.event.date)}</span></div>
                        <div className="text-slate-400">💰 $20/hr · Setup {shift.event.setupTimeMins}min</div>
                      </div>
                      {shift.status === 'ASSIGNED' && (
                        <Link to={`/checkin/${shift.id}`} className="block mt-3">
                          <Button className="w-full" size="sm">Check In</Button>
                        </Link>
                      )}
                      {shift.status === 'CHECKED_IN' && (
                        <Link to={`/checkin/${shift.id}`} className="block mt-3">
                          <Button className="w-full bg-yellow-400 hover:bg-yellow-500 text-slate-800" size="sm">Check Out</Button>
                        </Link>
                      )}
                    </Card>
                  ))}
                </div>
              )}

              {past.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Completed</h2>
                  {past.map((shift) => (
                    <Card key={shift.id} className="p-4 opacity-80">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <div className="font-medium text-slate-700 text-sm">{shift.event.title}</div>
                        <Badge status={shift.status} />
                      </div>
                      <div className="text-xs text-slate-400">{formatShortDate(shift.event.date)}</div>
                      {shift.payment && (
                        <div className="mt-2 flex justify-between items-center">
                          <span className="text-xs text-slate-500">{formatHours(shift.payment.hoursWorked)} · $20/hr</span>
                          <span className="text-sm font-semibold text-slate-700">${shift.payment.amount.toFixed(2)}</span>
                        </div>
                      )}
                      {!shift.report && (
                        <Link to={`/report/${shift.id}`} className="block mt-2">
                          <Button size="sm" variant="mint_outline" className="w-full">Submit Report</Button>
                        </Link>
                      )}
                      {shift.report && <div className="mt-2 text-xs text-green-600">✓ Report submitted</div>}
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {openShifts.length === 0 ? (
            <Card className="p-6">
              <EmptyState icon="🎉" title="No open shifts right now" description="Check back soon — new shifts are posted regularly" />
            </Card>
          ) : (
            openShifts.map((shift) => (
              <Card key={shift.id} className="p-4">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div className="font-medium text-slate-800 text-sm">{shift.event.title}</div>
                  <Badge status="OPEN" />
                </div>
                <div className="space-y-1 text-xs text-slate-500 mb-3">
                  <div className="flex items-start gap-1.5"><MapPin size={11} className="mt-0.5 shrink-0" /><span className="truncate">{shift.event.location}</span></div>
                  <div className="flex items-center gap-1.5"><Clock size={11} /><span className="text-mint-600 font-medium">{formatShortDate(shift.event.date)}</span></div>
                  {shift.event.milesFromHq && (
                    <div className="text-slate-400">{shift.event.milesFromHq} mi · {shift.event.driveTimeMins} min drive from HQ</div>
                  )}
                  <div className="text-slate-400">💰 $20/hr · Setup {shift.event.setupTimeMins}min · Breakdown {shift.event.breakdownTimeMins}min</div>
                </div>
                {shift.event.notes && (
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2 mb-3 line-clamp-2">{shift.event.notes}</p>
                )}
                <Button
                  onClick={() => handleClaim(shift.id)}
                  disabled={claiming === shift.id}
                  className="w-full"
                  size="sm"
                >
                  {claiming === shift.id ? 'Claiming...' : 'Claim Shift'}
                </Button>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
