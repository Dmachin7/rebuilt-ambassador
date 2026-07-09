import React, { useEffect, useState, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { availabilityAPI } from '../api/index.js';
import { Card, Button, Modal, Textarea, Spinner } from './ui/index.jsx';

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Open', color: '#4ade80', textColor: '#14532d' },
  { value: 'UNAVAILABLE', label: 'Not Available', color: '#f87171', textColor: '#7f1d1d' },
  { value: 'OTHER', label: 'Other', color: '#fbbf24', textColor: '#78350f' },
];

const colorFor = (status) => STATUS_OPTIONS.find((s) => s.value === status)?.color || '#e2e8f0';

// Enumerates local YYYY-MM-DD date strings in [startStr, endStr) — matches FullCalendar's
// date-only select() range (endStr is exclusive, the day after the last selected cell).
function enumerateDates(startStr, endStr) {
  const dates = [];
  let cur = new Date(`${startStr}T00:00:00Z`);
  const end = new Date(`${endStr}T00:00:00Z`);
  while (cur < end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur = new Date(cur.getTime() + 86400000);
  }
  return dates;
}

const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return new Date(d.getTime() + n * 86400000).toISOString().slice(0, 10);
};

// Shared month calendar for setting/viewing day-by-day ambassador availability. Used both by the
// ambassador's own "My Availability" page and the admin/EC availability page (via `editable` +
// `onSave`, which differ because ambassadors PUT /availability (self) while admin/EC PUT
// /availability/:userId).
export default function AvailabilityCalendar({ userId, editable = true, validRange, onSave }) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(null); // { start, end } currently visible, ISO date strings
  const [selection, setSelection] = useState(null); // { startStr, endStr } pending edit
  const [status, setStatus] = useState('OPEN');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback((start, end) => {
    if (!userId || !start || !end) return;
    setLoading(true);
    availabilityAPI.get(userId, start, end)
      .then(setDays)
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    if (range) load(range.start, range.end);
  }, [userId, range, load]);

  const handleDatesSet = (info) => {
    setRange({ start: info.startStr.slice(0, 10), end: info.endStr.slice(0, 10) });
  };

  const handleSelect = (info) => {
    if (!editable) return;
    const startStr = info.startStr.slice(0, 10);
    const endStr = info.endStr.slice(0, 10);
    const existing = days.find((d) => d.date.slice(0, 10) === startStr);
    setStatus(existing?.status || 'OPEN');
    setNote(existing?.note || '');
    setSelection({ startStr, endStr });
  };

  const closeModal = () => setSelection(null);

  const handleSaveDay = async () => {
    if (!selection) return;
    setSaving(true);
    try {
      const dates = enumerateDates(selection.startStr, selection.endStr);
      const payload = dates.map((date) => ({ date, status, note: status === 'OTHER' ? note : null }));
      await onSave(payload);
      // Merge locally so the calendar reflects the change without waiting on a refetch
      setDays((prev) => {
        const kept = prev.filter((d) => !dates.includes(d.date.slice(0, 10)));
        const added = dates.map((date) => ({ date, status, note: status === 'OTHER' ? note : null }));
        return [...kept, ...added];
      });
      setSelection(null);
    } catch (err) {
      alert('Failed to save availability: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const backgroundEvents = days.map((d) => {
    const dateStr = d.date.slice(0, 10);
    return {
      start: dateStr,
      end: addDays(dateStr, 1),
      display: 'background',
      backgroundColor: colorFor(d.status),
    };
  });

  const selectionLabel = selection
    ? selection.startStr === addDays(selection.endStr, -1)
      ? new Date(`${selection.startStr}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
      : `${selection.startStr} – ${addDays(selection.endStr, -1)}`
    : '';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-xs">
        {STATUS_OPTIONS.map((s) => (
          <div key={s.value} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-slate-600">{s.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border border-slate-300 bg-white" />
          <span className="text-slate-600">Not set</span>
        </div>
      </div>

      <Card className="p-2 overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
            <Spinner className="w-6 h-6" />
          </div>
        )}
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
          validRange={validRange}
          selectable={editable}
          select={handleSelect}
          datesSet={handleDatesSet}
          events={backgroundEvents}
          height="auto"
        />
      </Card>

      <Modal isOpen={!!selection} onClose={closeModal} title={selectionLabel}>
        <div className="space-y-4">
          <div className="space-y-2">
            {STATUS_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                  status === opt.value ? 'border-mint-400 bg-mint-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="availability-status"
                  checked={status === opt.value}
                  onChange={() => setStatus(opt.value)}
                  className="accent-mint-600"
                />
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                <span className="text-sm text-slate-700">{opt.label}</span>
              </label>
            ))}
          </div>
          {status === 'OTHER' && (
            <Textarea
              label="What times can you work this day?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Only available after 3pm"
            />
          )}
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSaveDay} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
