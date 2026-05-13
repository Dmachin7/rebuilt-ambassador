import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { eventsAPI } from '../../api/index.js';
import { Card, Button, Badge, Modal, Input, Textarea, Spinner, EmptyState } from '../../components/ui/index.jsx';
import { formatShortDate } from '../../utils/formatters.js';
import { Plus, MapPin, Clock, Users, Trash2, Edit2 } from 'lucide-react';
import { autocompleteLocation } from '../../stubs/maps.js';

const EMPTY_FORM = {
  title: '', location: '', contactName: '', contactPhone: '', contactEmail: '',
  startDate: '', startTime: '', endDate: '', endTime: '',
  setupTimeMins: 30, ambassadorsNeeded: 1,
  samplesNeeded: '', snackBitesNeeded: '', notes: '',
};

// Extract local YYYY-MM-DD from a date value
const toLocalDate = (dt) => {
  const d = new Date(dt);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
};

// Extract local HH:MM from a date value
const toLocalTime = (dt) => {
  const d = new Date(dt);
  return [String(d.getHours()).padStart(2, '0'), String(d.getMinutes()).padStart(2, '0')].join(':');
};

// Combine date + time strings into an ISO string the backend can parse
const combineDatetime = (date, time) => {
  if (!date) return null;
  return new Date(`${date}T${time || '00:00'}`).toISOString();
};

function LocationAutocomplete({ value, onChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  const handleInput = (e) => {
    const q = e.target.value;
    onChange(q);
    clearTimeout(debounceRef.current);
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      const results = await autocompleteLocation(q);
      setSuggestions(results);
      setOpen(results.length > 0);
    }, 300);
  };

  const select = (desc) => {
    onChange(desc);
    setSuggestions([]);
    setOpen(false);
  };

  useEffect(() => {
    const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        label="Location *"
        value={value}
        onChange={handleInput}
        placeholder="Start typing an address..."
        autoComplete="off"
      />
      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {suggestions.map((s) => (
            <li
              key={s.placeId}
              onMouseDown={() => select(s.description)}
              className="px-3 py-2.5 text-sm text-slate-700 hover:bg-mint-50 cursor-pointer flex items-center gap-2"
            >
              <MapPin size={13} className="text-slate-400 shrink-0" />
              {s.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DateTimeRow({ dateLabel, timeLabel, dateValue, timeValue, onDateChange, onTimeChange, required }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          {dateLabel}{required && ' *'}
        </label>
        <input
          type="date"
          value={dateValue}
          onChange={(e) => onDateChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-mint-400 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">{timeLabel}</label>
        <input
          type="time"
          value={timeValue}
          onChange={(e) => onTimeChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-mint-400 focus:border-transparent"
        />
      </div>
    </div>
  );
}

export default function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => eventsAPI.list(filter || undefined).then(setEvents).finally(() => setLoading(false));

  useEffect(() => { setLoading(true); load(); }, [filter]);

  const openCreate = () => { setEditingEvent(null); setForm(EMPTY_FORM); setError(''); setModalOpen(true); };

  const openEdit = (e, event) => {
    e.preventDefault();
    setEditingEvent(event);
    setForm({
      title: event.title,
      location: event.location,
      contactName: event.contactName || '',
      contactPhone: event.contactPhone || '',
      contactEmail: event.contactEmail || '',
      startDate: toLocalDate(event.date),
      startTime: toLocalTime(event.date),
      endDate: event.endTime ? toLocalDate(event.endTime) : '',
      endTime: event.endTime ? toLocalTime(event.endTime) : '',
      setupTimeMins: event.setupTimeMins,
      ambassadorsNeeded: event.ambassadorsNeeded,
      samplesNeeded: event.samplesNeeded || '',
      snackBitesNeeded: event.snackBitesNeeded || '',
      notes: event.notes || '',
    });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.location || !form.startDate) {
      setError('Title, location, and start date are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        date: combineDatetime(form.startDate, form.startTime),
        endTime: form.endDate ? combineDatetime(form.endDate, form.endTime) : null,
      };
      if (editingEvent) {
        await eventsAPI.update(editingEvent.id, payload);
      } else {
        await eventsAPI.create(payload);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.preventDefault();
    if (!confirm('Delete this event? All shifts and messages will also be deleted.')) return;
    await eventsAPI.delete(id);
    load();
  };

  const f = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const set = (field) => (val) => setForm((prev) => ({ ...prev, [field]: val }));

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
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {[['', 'All'], ['UPCOMING', 'Upcoming'], ['ACTIVE', 'Active'], ['COMPLETED', 'Completed']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === val ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {events.length === 0 ? (
        <Card className="p-8"><EmptyState icon="📅" title="No events found" action={<Button onClick={openCreate}><Plus size={14} /> Create your first event</Button>} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => {
            const assigned = event.shifts.filter((s) => s.ambassadorId).length;
            const total = event.shifts.length;
            return (
              <Link key={event.id} to={`/admin/events/${event.id}`} className="block">
                <Card className="p-4 hover:shadow-md transition-shadow h-full">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-semibold text-slate-800 text-sm leading-tight">{event.title}</h3>
                    <Badge status={event.status} />
                  </div>
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
                      <div className="text-slate-400">{event.milesFromHq} mi · {event.driveTimeMins} min drive</div>
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

      {/* Create/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingEvent ? 'Edit Event' : 'New Event'} size="lg">
        <div className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg border border-red-200">{error}</div>}

          <Input label="Event Title *" value={form.title} onChange={f('title')} placeholder="e.g. Whole Foods Demo – South Austin" />

          <LocationAutocomplete
            value={form.location}
            onChange={set('location')}
          />

          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Start</p>
            <DateTimeRow
              dateLabel="Date" timeLabel="Time"
              dateValue={form.startDate} timeValue={form.startTime}
              onDateChange={set('startDate')} onTimeChange={set('startTime')}
              required
            />
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              End <span className="text-slate-400 normal-case font-normal">(optional)</span>
            </p>
            <DateTimeRow
              dateLabel="Date" timeLabel="Time"
              dateValue={form.endDate} timeValue={form.endTime}
              onDateChange={set('endDate')} onTimeChange={set('endTime')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Ambassadors Needed" type="number" min="1" value={form.ambassadorsNeeded} onChange={f('ambassadorsNeeded')} />
            <Input label="Setup (mins)" type="number" min="0" value={form.setupTimeMins} onChange={f('setupTimeMins')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Sample Meals" type="number" min="0" value={form.samplesNeeded} onChange={f('samplesNeeded')} placeholder="Optional" />
            <Input label="Snack Bites" type="number" min="0" value={form.snackBitesNeeded} onChange={f('snackBitesNeeded')} placeholder="Optional" />
          </div>

          <div className="bg-mint-50 rounded-lg px-3 py-2 text-xs text-slate-600">
            💰 Pay rate: <strong>$20/hr</strong> (fixed)
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-600 mb-3 uppercase tracking-wide">Event Contact</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input label="Name" value={form.contactName} onChange={f('contactName')} placeholder="Contact name" />
              <Input label="Phone" value={form.contactPhone} onChange={f('contactPhone')} placeholder="512-555-0000" />
              <Input label="Email" type="email" value={form.contactEmail} onChange={f('contactEmail')} placeholder="email@store.com" />
            </div>
          </div>

          <Textarea label="Notes" value={form.notes} onChange={f('notes')} rows={3} placeholder="Setup instructions, parking info, special notes..." />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editingEvent ? 'Save Changes' : 'Create Event'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
