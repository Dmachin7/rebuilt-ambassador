import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { eventsAPI } from '../../api/index.js';
import { Card, Button, Badge, Modal, Input, Textarea, Select, Spinner, EmptyState } from '../../components/ui/index.jsx';
import { formatDate, formatShortDate } from '../../utils/formatters.js';
import { Plus, MapPin, Phone, Mail, Clock, Users, Trash2, Edit2 } from 'lucide-react';

const EMPTY_FORM = {
  title: '', location: '', contactName: '', contactPhone: '', contactEmail: '',
  date: '', setupTimeMins: 30, breakdownTimeMins: 30, ambassadorsNeeded: 1,
  samplesNeeded: '', notes: '',
};

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
      title: event.title, location: event.location,
      contactName: event.contactName || '', contactPhone: event.contactPhone || '',
      contactEmail: event.contactEmail || '',
      date: new Date(event.date).toISOString().slice(0, 16),
      setupTimeMins: event.setupTimeMins, breakdownTimeMins: event.breakdownTimeMins,
      ambassadorsNeeded: event.ambassadorsNeeded, samplesNeeded: event.samplesNeeded || '',
      notes: event.notes || '',
    });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.location || !form.date) { setError('Title, location, and date are required'); return; }
    setSaving(true);
    try {
      if (editingEvent) {
        await eventsAPI.update(editingEvent.id, form);
      } else {
        await eventsAPI.create(form);
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
          <Input label="Location *" value={form.location} onChange={f('location')} placeholder="Full address" />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Date & Time *" type="datetime-local" value={form.date} onChange={f('date')} />
            <Input label="Ambassadors Needed" type="number" min="1" value={form.ambassadorsNeeded} onChange={f('ambassadorsNeeded')} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input label="Setup (mins)" type="number" min="0" value={form.setupTimeMins} onChange={f('setupTimeMins')} />
            <Input label="Breakdown (mins)" type="number" min="0" value={form.breakdownTimeMins} onChange={f('breakdownTimeMins')} />
            <Input label="Samples Needed" type="number" min="0" value={form.samplesNeeded} onChange={f('samplesNeeded')} placeholder="Optional" />
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
