import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { eventsAPI, shiftsAPI, usersAPI } from '../../api/index.js';
import { Badge, Button, Card, Modal, Select, Spinner } from '../../components/ui/index.jsx';
import EventFormModal from '../../components/EventFormModal.jsx';
import { eventColor, formatDateTime, formatHours, formatTime } from '../../utils/formatters.js';
import { Save, UserPlus, Search } from 'lucide-react';

export default function AdminCalendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const isMobile = window.innerWidth < 640;
  const [selected, setSelected] = useState(null);
  const [pendingChanges, setPendingChanges] = useState({}); // eventId → newDate
  const [saving, setSaving] = useState(false);
  const [bagSaving, setBagSaving] = useState(false);
  const [hoursData, setHoursData] = useState([]); // per-ambassador worked/paid hours for the visible range
  const [upcomingHoursData, setUpcomingHoursData] = useState([]); // per-ambassador assigned-but-not-yet-completed hours
  const [visibleRange, setVisibleRange] = useState(null); // { start, end, viewType }
  const [staff, setStaff] = useState([]); // ADMIN/EVENT_COORDINATOR users, for the "Bagged By" dropdown
  const [ambassadors, setAmbassadors] = useState([]); // for the assign/change-ambassador dropdown
  const [assignModal, setAssignModal] = useState(null); // shift being assigned/reassigned
  const [selectedAmb, setSelectedAmb] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formEditingEvent, setFormEditingEvent] = useState(null);
  const [formInitialDate, setFormInitialDate] = useState(null);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const loadEvents = useCallback(() => {
    return eventsAPI.list().then(setEvents);
  }, []);

  useEffect(() => {
    Promise.all([
      loadEvents(),
      usersAPI.list().then((all) => setStaff(all.filter((u) => u.role === 'ADMIN' || u.role === 'EVENT_COORDINATOR'))),
      usersAPI.list('AMBASSADOR').then(setAmbassadors),
    ]).finally(() => setLoading(false));
  }, [loadEvents]);

  // Refetches events after an assign/unassign so both the calendar grid and the still-open
  // side panel (a snapshot, not a live reference into `events`) reflect the change.
  const reloadAndSyncSelected = async () => {
    const fresh = await eventsAPI.list();
    setEvents(fresh);
    setSelected((prev) => (prev ? fresh.find((e) => e.id === prev.id) || null : prev));
  };

  const handleAssign = async () => {
    if (!assignModal || !selectedAmb) return;
    setAssignSaving(true);
    try {
      await shiftsAPI.assign(assignModal.id, selectedAmb);
      setAssignModal(null);
      setSelectedAmb('');
      await reloadAndSyncSelected();
    } catch (err) {
      alert(err.message);
    } finally {
      setAssignSaving(false);
    }
  };

  const handleUnassign = async (shiftId) => {
    if (!confirm('Remove ambassador from this shift?')) return;
    try {
      await shiftsAPI.unassign(shiftId);
      await reloadAndSyncSelected();
    } catch (err) {
      alert(err.message);
    }
  };

  // Ambassador hours are scoped to whatever month/week is currently visible on the calendar,
  // refetched whenever the view range changes (month/week navigation, or switching views).
  useEffect(() => {
    if (!visibleRange) return;
    shiftsAPI.hours(visibleRange.start, visibleRange.end).then(setHoursData).catch(() => {});
    shiftsAPI.upcomingHours(visibleRange.start, visibleRange.end).then(setUpcomingHoursData).catch(() => {});
  }, [visibleRange]);

  const handleDatesSet = (arg) => {
    setVisibleRange({
      start: arg.view.activeStart.toISOString(),
      end: arg.view.activeEnd.toISOString(),
      viewType: arg.view.type,
    });
  };

  const rangeLabel = !visibleRange ? ''
    : visibleRange.viewType.includes('Week') ? 'This Week'
    : 'This Month';

  const query = search.trim().toLowerCase();
  const searching = query.length > 0;
  const matchesSearch = (e) =>
    !searching ||
    e.title.toLowerCase().includes(query) ||
    (e.location || '').toLowerCase().includes(query) ||
    (e.pickupLocation || '').toLowerCase().includes(query);

  // Sorted most-recent-first purely for the sidebar "search results" list below — finding the
  // last time we went somewhere is the point of the search, so that match should lead.
  const searchResults = searching
    ? [...events].filter(matchesSearch).sort((a, b) => new Date(b.date) - new Date(a.date))
    : null;
  // "Last time" means the most recent occurrence that's already happened — an upcoming
  // scheduled visit further out shouldn't win just because its date sorts later.
  const now = new Date();
  const lastMatch = searchResults?.find((e) => e.status === 'COMPLETED' || new Date(e.date) < now) || null;

  const calendarEvents = events.filter(matchesSearch).map((e) => {
    const assigned = e.shifts.filter((s) => s.ambassadorId).length;
    const total = e.shifts.length;
    const hasPending = pendingChanges[e.id] !== undefined;
    return {
      id: e.id,
      title: e.title,
      start: pendingChanges[e.id] || e.date,
      end: new Date(new Date(pendingChanges[e.id] || e.date).getTime() + 4 * 3600000).toISOString(),
      backgroundColor: hasPending ? '#f59e0b' : eventColor(e.status),
      borderColor: hasPending ? '#d97706' : eventColor(e.status),
      textColor: '#1e3a2f',
      extendedProps: { event: e, assigned, total, hasPending },
    };
  });

  const handleEventClick = (info) => {
    setSelected(info.event.extendedProps.event);
  };

  const handleEventDoubleClick = (event) => {
    setFormEditingEvent(event);
    setFormInitialDate(null);
    setFormModalOpen(true);
  };

  const handleDateClick = (info) => {
    setFormEditingEvent(null);
    setFormInitialDate(info.dateStr.slice(0, 10));
    setFormModalOpen(true);
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

  // Quick "bagged & sent" toggle from the side panel, without opening the full edit modal.
  const applyBagUpdate = async (patch) => {
    if (!selected) return;
    setBagSaving(true);
    try {
      const updated = await eventsAPI.update(selected.id, patch);
      setSelected((prev) => ({ ...prev, ...updated }));
      setEvents((prev) => prev.map((e) => (e.id === selected.id ? { ...e, ...updated } : e)));
    } catch (err) {
      alert('Failed to update: ' + err.message);
    } finally {
      setBagSaving(false);
    }
  };

  const hasPending = Object.keys(pendingChanges).length > 0;

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Event Calendar</h1>
          <p className="text-sm text-slate-500">Click a date to add an event · double-click an event to edit · drag to reschedule.</p>
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

      {/* Search — filters the calendar grid and drives the "search results" sidebar list below,
          so finding the last time we went somewhere doesn't require paging through months. */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title or location..."
          className="input-field pl-8 text-sm py-1.5 w-full"
        />
      </div>

      {lastMatch && (
        <div className="bg-mint-50 border border-mint-200 rounded-lg px-4 py-2.5 text-sm text-mint-800">
          Last time: <span className="font-semibold">{new Date(lastMatch.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span> — {lastMatch.title} ({lastMatch.location})
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
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-amber-200" />
          <span className="text-slate-600">Deliver to</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded bg-green-200" />
          <span className="text-slate-600">Bagged & sent</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <Card className="p-2 overflow-hidden">
            <FullCalendar
              plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
              initialView={isMobile ? 'listMonth' : 'dayGridMonth'}
              firstDay={1}
              headerToolbar={isMobile ? {
                left: 'prev,next',
                center: 'title',
                right: 'today',
              } : {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,dayGridWeek,listWeek',
              }}
              events={calendarEvents}
              eventClick={handleEventClick}
              dateClick={handleDateClick}
              eventDidMount={(info) => {
                info.el.addEventListener('dblclick', () => handleEventDoubleClick(info.event.extendedProps.event));
              }}
              editable={!isMobile}
              eventDrop={handleEventDrop}
              height="auto"
              dayMaxEvents={false}
              eventDisplay="block"
              datesSet={handleDatesSet}
              eventContent={(arg) => {
                const { event: ev, hasPending: isPending } = arg.event.extendedProps;
                const start = pendingChanges[ev.id] || ev.date;
                return (
                  <div className="px-1 py-0.5 text-[11px] leading-tight w-full">
                    <div className="font-semibold text-slate-800">{isPending ? '* ' : ''}{ev.title}</div>
                    <div className="text-slate-700">
                      {formatTime(start)}{ev.endTime ? ` – ${formatTime(ev.endTime)}` : ''}
                    </div>
                    {ev.location && (
                      <div className="text-slate-600 truncate">📍 {ev.location}</div>
                    )}
                    <div className="text-slate-600 truncate">
                      👤 {ev.shifts.filter((s) => s.ambassador).length > 0
                        ? ev.shifts.filter((s) => s.ambassador).map((s) => s.ambassador.firstName).join(', ')
                        : 'Unassigned'}
                    </div>
                    {ev.pickupLocation && (
                      <div className="mt-0.5 px-1 py-0.5 rounded bg-amber-200/80 text-amber-900 font-medium">
                        → {ev.pickupLocation}
                      </div>
                    )}
                    {(ev.samplesNeeded || ev.breakfastsNeeded || ev.snackBitesNeeded) && (
                      <div className="text-slate-600 mt-0.5">
                        {[
                          ev.samplesNeeded ? `📦 ${ev.samplesNeeded} meals` : '',
                          ev.breakfastsNeeded ? `🍳 ${ev.breakfastsNeeded} breakfasts` : '',
                          ev.snackBitesNeeded ? `🍬 ${ev.snackBitesNeeded} snacks` : '',
                        ].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    <div className={`mt-0.5 px-1 py-0.5 rounded font-medium ${
                      ev.baggedAndSent ? 'bg-green-200/80 text-green-900' : 'bg-slate-200/70 text-slate-500'
                    }`}>
                      {ev.baggedAndSent ? `✓ Bagged${ev.baggedBy ? ' by ' + ev.baggedBy.firstName : ''}` : 'Not yet bagged'}
                    </div>
                  </div>
                );
              }}
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
                {selected.pickupLocation && (
                  <div className="flex items-start gap-1.5">📦 Deliver to: {selected.pickupLocation}</div>
                )}
                {(selected.samplesNeeded || selected.breakfastsNeeded || selected.snackBitesNeeded) && (
                  <div className="flex gap-3">
                    {selected.samplesNeeded && <span>{selected.samplesNeeded} meals</span>}
                    {selected.breakfastsNeeded && <span>{selected.breakfastsNeeded} breakfasts</span>}
                    {selected.snackBitesNeeded && <span>{selected.snackBitesNeeded} snacks</span>}
                  </div>
                )}
                <div className="font-medium text-slate-700">
                  {selected.shifts.filter((s) => s.ambassadorId).length}/{selected.shifts.length} ambassadors
                </div>
                <div className="space-y-1.5">
                  {selected.shifts.map((shift) => (
                    <div key={shift.id} className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg px-2 py-1.5">
                      <span className="truncate">
                        {shift.ambassador
                          ? `${shift.ambassador.firstName} ${shift.ambassador.lastName}`
                          : <span className="text-slate-400 italic">Open shift</span>}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => { setAssignModal(shift); setSelectedAmb(shift.ambassadorId || ''); }}
                          className="text-mint-600 hover:text-mint-700 font-medium flex items-center gap-1"
                        >
                          <UserPlus size={11} /> {shift.ambassador ? 'Change' : 'Assign'}
                        </button>
                        {shift.ambassador && (
                          <button onClick={() => handleUnassign(shift.id)} className="text-slate-400 hover:text-red-500">
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick bagged/sent toggle */}
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                <label className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                  selected.baggedAndSent ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:bg-slate-50'
                } ${bagSaving ? 'opacity-60' : ''}`}>
                  <input
                    type="checkbox"
                    checked={!!selected.baggedAndSent}
                    disabled={bagSaving}
                    onChange={(e) => applyBagUpdate({ baggedAndSent: e.target.checked })}
                    className="accent-green-500"
                  />
                  <span className="text-slate-700">Bagged & Sent to Location</span>
                </label>
                <Select
                  value={selected.baggedByUserId || ''}
                  disabled={bagSaving}
                  onChange={(e) => applyBagUpdate({ baggedByUserId: e.target.value || null })}
                  className="text-xs"
                >
                  <option value="">Bagged By — Select —</option>
                  {staff.map((u) => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </Select>
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

          {/* Hours sidebar, scoped to the visible month/week */}
          {hoursData.length > 0 && (
            <Card className="p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Ambassador Hours ({rangeLabel})</p>
              <div className="space-y-2">
                {hoursData.slice(0, 8).map((h) => (
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

          {/* Upcoming (assigned but not yet completed) hours, scoped to the visible month/week —
              sorted lowest-first so under-booked ambassadors are easy to spot. */}
          {upcomingHoursData.length > 0 && (
            <Card className="p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Upcoming Hours ({rangeLabel})</p>
              <div className="space-y-2">
                {[...upcomingHoursData].sort((a, b) => a.totalHours - b.totalHours).slice(0, 8).map((h) => (
                  <div key={h.ambassador?.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-xs font-medium text-amber-700 shrink-0">
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

          {/* Upcoming list — swaps to search results (most recent first) while searching */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {searching ? `Search Results (${searchResults.length})` : 'Upcoming Events'}
            </p>
            {(searching ? searchResults : events.filter((e) => e.status === 'UPCOMING')).slice(0, searching ? 15 : 5).map((e) => (
              <button
                key={e.id}
                onClick={() => setSelected(e)}
                className={`w-full text-left bg-white border rounded-lg px-3 py-2 hover:border-mint-300 transition-colors ${pendingChanges[e.id] ? 'border-amber-300' : 'border-slate-100'}`}
              >
                <div className="text-xs font-medium text-slate-700 truncate">{e.title}</div>
                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                  {new Date(pendingChanges[e.id] || e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {searching && <span className="truncate">· {e.location}</span>}
                  {pendingChanges[e.id] && <span className="text-amber-500 ml-1">*unsaved</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <EventFormModal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        editingEvent={formEditingEvent}
        initialDate={formInitialDate}
        onSaved={() => {
          loadEvents();
          if (formEditingEvent) setSelected(null);
        }}
      />

      {/* Assign/Change Ambassador Modal — also used to reassign an already-assigned shift, since
          assign() just overwrites ambassadorId */}
      <Modal isOpen={!!assignModal} onClose={() => setAssignModal(null)} title={assignModal?.ambassadorId ? 'Change Ambassador' : 'Assign Ambassador'}>
        <div className="space-y-4">
          <Select label="Select Ambassador" value={selectedAmb} onChange={(e) => setSelectedAmb(e.target.value)}>
            <option value="">— Choose an ambassador —</option>
            {ambassadors.map((a) => (
              <option key={a.id} value={a.id}>{a.firstName} {a.lastName} ({a.email})</option>
            ))}
          </Select>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setAssignModal(null)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={!selectedAmb || assignSaving}>
              {assignSaving ? 'Saving...' : assignModal?.ambassadorId ? 'Save' : 'Assign'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
