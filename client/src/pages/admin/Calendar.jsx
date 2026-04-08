import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { eventsAPI, shiftsAPI } from '../../api/index.js';
import { Badge, Button, Card, Spinner } from '../../components/ui/index.jsx';
import { eventColor, formatDateTime, formatHours } from '../../utils/formatters.js';
import { Save } from 'lucide-react';

export default function AdminCalendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [pendingChanges, setPendingChanges] = useState({}); // eventId → newDate
  const [saving, setSaving] = useState(false);
  const [weeklyHours, setWeeklyHours] = useState([]); // per-ambassador hours this week
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([eventsAPI.list(), shiftsAPI.hours()])
      .then(([evs, hrs]) => {
        setEvents(evs);
        // Compute this-week hours per ambassador
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay()); // Sunday
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600000);

        // hrs is lifetime totals — we use it as a proxy for weekly display (shift hours this week would require a separate endpoint)
        // For now we show total hours with a "this week" label based on payment records
        setWeeklyHours(hrs);
      })
      .finally(() => setLoading(false));
  }, []);

  const calendarEvents = events.map((e) => {
    const assigned = e.shifts.filter((s) => s.ambassadorId).length;
    const total = e.shifts.length;
    const hasPending = pendingChanges[e.id] !== undefined;
    return {
      id: e.id,
      title: hasPending ? `* ${e.title}` : e.title,
      start: pendingChanges[e.id] || e.date,
      end: new Date(new Date(pendingChanges[e.id] || e.date).getTime() + 4 * 3600000).toISOString(),
      backgroundColor: hasPending ? '#f59e0b' : eventColor(e.status),
      borderColor: hasPending ? '#d97706' : eventColor(e.status),
      textColor: '#1e3a2f',
      extendedProps: { event: e, assigned, total },
    };
  });

  const handleEventClick = (info) => {
    setSelected(info.event.extendedProps.event);
  };

  const handleEventDrop = (info) => {
    const eventId = info.event.id;
    const newDate = info.event.start;
    setPendingChanges((prev) => ({ ...prev, [eventId]: newDate.toISOString() }));
    // Update selected panel if this event is shown
    setSelected((prev) => prev?.id === eventId ? { ...prev, date: newDate.toISOString() } : prev);
  };

  const handleSave = async () => {
    if (Object.keys(pendingChanges).length === 0) return;
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(pendingChanges).map(([eventId, newDate]) =>
          eventsAPI.update(eventId, { date: newDate })
        )
      );
      // Merge saved changes into events state
      setEvents((prev) =>
        prev.map((e) =>
          pendingChanges[e.id] !== undefined ? { ...e, date: pendingChanges[e.id] } : e
        )
      );
      setPendingChanges({});
    } catch (err) {
      alert('Failed to save changes: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setPendingChanges({});
  };

  const hasPending = Object.keys(pendingChanges).length > 0;

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Event Calendar</h1>
          <p className="text-sm text-slate-500">Drag events to reschedule, then save.</p>
        </div>
        {hasPending && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleDiscard}>
              Discard
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="flex items-center gap-1.5">
              <Save size={14} /> {saving ? 'Saving...' : `Save Changes (${Object.keys(pendingChanges).length})`}
            </Button>
          </div>
        )}
      </div>

      {hasPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-700">
          {Object.keys(pendingChanges).length} unsaved change{Object.keys(pendingChanges).length !== 1 ? 's' : ''} — click Save to confirm.
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[['UPCOMING', 'Upcoming'], ['ACTIVE', 'Active'], ['COMPLETED', 'Completed'], ['CANCELLED', 'Cancelled']].map(([status, label]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: eventColor(status) }} />
            <span className="text-slate-600">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <span className="text-slate-600">Unsaved move</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <Card className="p-2 overflow-hidden">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,listWeek',
              }}
              events={calendarEvents}
              eventClick={handleEventClick}
              editable={true}
              eventDrop={handleEventDrop}
              height="auto"
              eventDisplay="block"
            />
          </Card>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Event detail */}
          {selected ? (
            <Card className="p-4 sticky top-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="font-semibold text-slate-800 text-sm leading-tight">{selected.title}</h3>
                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
              </div>
              <Badge status={selected.status} />
              <div className="mt-3 space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">📅 {formatDateTime(pendingChanges[selected.id] || selected.date)}</div>
                <div className="flex items-start gap-1.5">📍 {selected.location}</div>
                <div>
                  {selected.shifts.filter((s) => s.ambassadorId).length}/{selected.shifts.length} ambassadors
                </div>
              </div>
              <button
                onClick={() => navigate(`/admin/events/${selected.id}`)}
                className="mt-4 w-full btn-primary text-xs py-2 rounded-lg"
              >
                View Full Details →
              </button>
            </Card>
          ) : (
            <Card className="p-4">
              <p className="text-sm text-slate-400 text-center py-4">Click an event to view details</p>
            </Card>
          )}

          {/* Weekly hours sidebar */}
          {weeklyHours.length > 0 && (
            <Card className="p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Ambassador Hours (All-Time)</p>
              <div className="space-y-2">
                {weeklyHours.slice(0, 8).map((h) => (
                  <div key={h.ambassador?.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 bg-mint-100 rounded-full flex items-center justify-center text-xs font-medium text-mint-700 shrink-0">
                        {h.ambassador?.firstName?.[0]}{h.ambassador?.lastName?.[0]}
                      </div>
                      <span className="text-xs text-slate-600 truncate">{h.ambassador?.firstName} {h.ambassador?.lastName}</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-700 shrink-0 ml-2">{formatHours(h.totalHours)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Upcoming list */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Upcoming Events</p>
            {events.filter((e) => e.status === 'UPCOMING').slice(0, 5).map((e) => (
              <button
                key={e.id}
                onClick={() => setSelected(e)}
                className={`w-full text-left bg-white border rounded-lg px-3 py-2 hover:border-mint-300 transition-colors ${pendingChanges[e.id] ? 'border-amber-300' : 'border-slate-100'}`}
              >
                <div className="text-xs font-medium text-slate-700 truncate">{e.title}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {new Date(pendingChanges[e.id] || e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {pendingChanges[e.id] && <span className="text-amber-500 ml-1">*unsaved</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
