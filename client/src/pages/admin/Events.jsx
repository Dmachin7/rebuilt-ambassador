import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { eventsAPI } from '../../api/index.js';
import { Card, Button, Badge, Spinner, EmptyState } from '../../components/ui/index.jsx';
import EventFormModal from '../../components/EventFormModal.jsx';
import { formatShortDate } from '../../utils/formatters.js';
import { Plus, MapPin, Clock, Users, Trash2, Edit2 } from 'lucide-react';

export default function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('UPCOMING');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const load = () => eventsAPI.list(filter || undefined).then(setEvents).finally(() => setLoading(false));

  useEffect(() => { setLoading(true); load(); }, [filter]);

  // Restore scroll position when returning from an event's detail page, so backing out of an event
  // doesn't dump the admin back at the top of a long list. Only on the first load after mount —
  // later reloads (e.g. from changing the filter) should start at the top like a fresh list.
  const restoredScrollRef = useRef(false);
  useEffect(() => {
    if (loading || restoredScrollRef.current) return;
    restoredScrollRef.current = true;
    const saved = sessionStorage.getItem('adminEventsScrollY');
    if (saved) requestAnimationFrame(() => window.scrollTo(0, parseInt(saved, 10)));
  }, [loading]);

  // Track scroll position continuously (rather than saving on unmount) so it survives regardless of
  // when/how navigation away happens.
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        sessionStorage.setItem('adminEventsScrollY', String(window.scrollY));
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const openCreate = () => {
    setEditingEvent(null);
    setModalOpen(true);
  };

  const openEdit = (e, event) => {
    e.preventDefault();
    setEditingEvent(event);
    setModalOpen(true);
  };

  const handleDelete = async (e, id) => {
    e.preventDefault();
    if (!confirm('Delete this event? All shifts and messages will also be deleted.')) return;
    await eventsAPI.delete(id);
    load();
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Events</h1>
          <p className="text-sm text-slate-500">{events.length} events</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> New Event</Button>
      </div>

      {/* Filter tabs */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit min-w-max">
          {[['UPCOMING', 'Upcoming'], ['COMPLETED', 'Completed'], ['', 'All']].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === val ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {events.length === 0 ? (
        <Card className="p-8"><EmptyState icon="📅" title="No events found" action={<Button onClick={openCreate}><Plus size={14} /> Create your first event</Button>} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => {
            const assigned = event.shifts.filter((s) => s.ambassadorId).length;
            const total = event.shifts.length;
            const accentBorder = event.hasImportantNotes
              ? 'border-l-4 border-l-amber-400'
              : event.tentNeeded
              ? 'border-l-4 border-l-blue-400'
              : '';
            return (
              <Link key={event.id} to={`/admin/events/${event.id}`} className="block">
                <Card className={`p-4 hover:shadow-md transition-shadow h-full ${accentBorder}`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-semibold text-slate-800 text-sm leading-tight">{event.title}</h3>
                    <Badge status={event.status} />
                  </div>
                  {(event.hasImportantNotes || event.tentNeeded) && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {event.hasImportantNotes && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800">
                          ⚠️ Important Notes
                        </span>
                      )}
                      {event.tentNeeded && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800">
                          ⛺ Tent Needed
                        </span>
                      )}
                    </div>
                  )}
                  <div className="space-y-1.5 text-xs text-slate-500">
                    <div className="flex items-start gap-1.5">
                      <MapPin size={12} className="mt-0.5 shrink-0 text-slate-400" />
                      <span className="truncate">{event.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="text-slate-400" />
                      <span className="text-mint-600 font-medium">{formatShortDate(event.date)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users size={12} className="text-slate-400" />
                      <span className={assigned < total ? 'text-orange-600 font-medium' : 'text-green-600'}>
                        {assigned}/{total} ambassadors
                      </span>
                    </div>
                    {event.milesFromHq && (
                      <div className="text-slate-400">{event.milesFromHq} mi · {event.driveTimeMins} min drive (round-trip)</div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                    <button onClick={(e) => openEdit(e, event)} className="text-xs text-slate-500 hover:text-mint-600 flex items-center gap-1">
                      <Edit2 size={12} /> Edit
                    </button>
                    <button onClick={(e) => handleDelete(e, event.id)} className="text-xs text-slate-500 hover:text-red-500 flex items-center gap-1 ml-auto">
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <EventFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editingEvent={editingEvent}
        onSaved={load}
      />
    </div>
  );
}
