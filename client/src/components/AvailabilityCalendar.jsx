import React, { useEffect, useState, useCallback } from 'react';
import { availabilityAPI } from '../api/index.js';
import { Card, Button, Modal, Textarea, Spinner } from './ui/index.jsx';

export const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Open', dot: 'bg-green-400', cell: 'bg-green-50 border-green-300 text-green-800' },
  { value: 'UNAVAILABLE', label: 'Not Available', dot: 'bg-red-400', cell: 'bg-red-50 border-red-300 text-red-800' },
  { value: 'OTHER', label: 'Other', dot: 'bg-amber-400', cell: 'bg-amber-50 border-amber-300 text-amber-800' },
];

export const NOT_SET_CELL = 'bg-white border-slate-200 text-slate-400';

export const statusOption = (status) => STATUS_OPTIONS.find((s) => s.value === status);

export const todayStr = () => new Date().toISOString().slice(0, 10);

export const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return new Date(d.getTime() + n * 86400000).toISOString().slice(0, 10);
};

export const startOfWeek = (dateStr) => addDays(dateStr, -new Date(`${dateStr}T00:00:00Z`).getUTCDay());

export const formatShort = (dateStr) =>
  new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

// Shared week-by-week calendar for setting/viewing day-by-day ambassador availability. Used both by
// the ambassador's own "My Availability" page and the admin/EC availability page (via `editable` +
// `onSave`, which differ because ambassadors PUT /availability (self) while admin/EC PUT
// /availability/:userId).
//
// Shows one week at a time with a single tap-to-open-modal per day, rather than a full month grid
// with click-and-drag range selection — on mobile, drag-select had no tap-vs-drag threshold, so a
// finger tap on a narrow day cell was easily misread as a drag across the whole week row.
export default function AvailabilityCalendar({ userId, editable = true, validRange, onSave }) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayStr()));
  const [selectedDates, setSelectedDates] = useState(null); // date strings being edited: [day] or the whole in-range week
  const [status, setStatus] = useState('OPEN');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback((start, end) => {
    if (!userId) return;
    setLoading(true);
    availabilityAPI.get(userId, start, end)
      .then(setDays)
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    load(weekStart, addDays(weekStart, 6));
  }, [userId, weekStart, load]);

  const isInRange = (dateStr) =>
    (!validRange?.start || dateStr >= validRange.start) && (!validRange?.end || dateStr <= validRange.end);

  const prevDisabled = !!validRange?.start && addDays(weekStart, -1) < validRange.start;
  const nextDisabled = !!validRange?.end && addDays(weekStart, 7) > validRange.end;
  const isCurrentWeek = weekStart === startOfWeek(todayStr());

  const handleDayClick = (dateStr) => {
    if (!editable || !isInRange(dateStr)) return;
    const existing = days.find((d) => d.date.slice(0, 10) === dateStr);
    setStatus(existing?.status || 'OPEN');
    setNote(existing?.note || '');
    setSelectedDates([dateStr]);
  };

  const handleWeekClick = () => {
    const inRangeDays = weekDays.filter(isInRange);
    if (!editable || inRangeDays.length === 0) return;
    setStatus('OPEN');
    setNote('');
    setSelectedDates(inRangeDays);
  };

  const closeModal = () => setSelectedDates(null);

  const handleSaveDay = async () => {
    if (!selectedDates || selectedDates.length === 0) return;
    setSaving(true);
    try {
      const payload = selectedDates.map((date) => ({ date, status, note: status === 'OTHER' ? note : null }));
      await onSave(payload);
      setDays((prev) => [
        ...prev.filter((d) => !selectedDates.includes(d.date.slice(0, 10))),
        ...payload,
      ]);
      setSelectedDates(null);
    } catch (err) {
      alert('Failed to save availability: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const selectionLabel = !selectedDates
    ? ''
    : selectedDates.length === 1
    ? new Date(`${selectedDates[0]}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
    : `Whole week — ${formatShort(selectedDates[0])} – ${formatShort(selectedDates[selectedDates.length - 1])} (${selectedDates.length} days)`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-xs">
        {STATUS_OPTIONS.map((s) => (
          <div key={s.value} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${s.dot}`} />
            <span className="text-slate-600">{s.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border border-slate-300 bg-white" />
          <span className="text-slate-600">Not set</span>
        </div>
      </div>

      <Card className="p-3 relative">
        {loading && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 rounded-xl">
            <Spinner className="w-6 h-6" />
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <Button variant="secondary" size="sm" onClick={() => setWeekStart((w) => addDays(w, -7))} disabled={prevDisabled}>
            ‹ Prev
          </Button>
          <div className="text-center">
            <div className="text-sm font-semibold text-slate-700">
              {formatShort(weekStart)} – {formatShort(addDays(weekStart, 6))}
            </div>
            {!isCurrentWeek && (
              <button
                type="button"
                onClick={() => setWeekStart(startOfWeek(todayStr()))}
                className="text-xs text-mint-600 hover:underline"
              >
                Jump to this week
              </button>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={() => setWeekStart((w) => addDays(w, 7))} disabled={nextDisabled}>
            Next ›
          </Button>
        </div>

        {editable && (
          <button
            type="button"
            onClick={handleWeekClick}
            disabled={weekDays.filter(isInRange).length === 0}
            className="w-full mb-3 text-xs font-medium text-mint-700 border border-mint-300 bg-mint-50 hover:bg-mint-100 rounded-lg py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Mark whole week
          </button>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
          {weekDays.map((dateStr) => {
            const day = days.find((d) => d.date.slice(0, 10) === dateStr);
            const opt = statusOption(day?.status);
            const disabled = !editable || !isInRange(dateStr);
            const isToday = dateStr === todayStr();
            return (
              <button
                key={dateStr}
                type="button"
                disabled={disabled}
                onClick={() => handleDayClick(dateStr)}
                className={`flex items-center justify-between sm:flex-col sm:justify-center sm:text-center gap-1 rounded-lg border px-3 py-3 text-left transition-colors ${
                  opt ? opt.cell : NOT_SET_CELL
                } ${isToday ? 'ring-2 ring-mint-400' : ''} ${
                  disabled ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-95 cursor-pointer'
                }`}
              >
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide opacity-70">
                    {new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}
                  </div>
                  <div className="text-base font-semibold">
                    {new Date(`${dateStr}T00:00:00Z`).getUTCDate()}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium sm:justify-center">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${opt ? opt.dot : 'bg-slate-200'}`} />
                  <span className="sm:hidden">{opt ? opt.label : 'Not set'}</span>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Modal isOpen={!!selectedDates} onClose={closeModal} title={selectionLabel}>
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
                <div className={`w-3 h-3 rounded-full shrink-0 ${opt.dot}`} />
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
