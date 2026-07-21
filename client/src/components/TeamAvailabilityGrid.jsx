import React, { useEffect, useState } from 'react';
import { availabilityAPI } from '../api/index.js';
import { Card, Button, Modal, Textarea, Spinner, EmptyState } from './ui/index.jsx';
import { STATUS_OPTIONS, NOT_SET_CELL, statusOption, todayStr, addDays, startOfWeek, formatShort } from './AvailabilityCalendar.jsx';

// Week-at-a-glance grid of every ambassador's availability, so admins/ECs can compare who's open on
// a given day without clicking into each person one at a time. Editing a cell opens a small modal
// scoped to that one ambassador/day and saves via the same admin PUT /availability/:userId endpoint
// the single-ambassador view uses.
export default function TeamAvailabilityGrid({ ambassadors }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayStr()));
  const [dataByUser, setDataByUser] = useState({}); // { [userId]: AvailabilityDay[] }
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { userId, date, name }
  const [status, setStatus] = useState('OPEN');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const weekEnd = addDays(weekStart, 6);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isCurrentWeek = weekStart === startOfWeek(todayStr());

  useEffect(() => {
    if (ambassadors.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all(ambassadors.map((a) => availabilityAPI.get(a.id, weekStart, weekEnd)))
      .then((results) => {
        if (cancelled) return;
        const map = {};
        ambassadors.forEach((a, i) => { map[a.id] = results[i]; });
        setDataByUser(map);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambassadors, weekStart]);

  const openCell = (ambassador, dateStr) => {
    const existing = (dataByUser[ambassador.id] || []).find((d) => d.date.slice(0, 10) === dateStr);
    setStatus(existing?.status || 'OPEN');
    setNote(existing?.note || '');
    setEditing({ userId: ambassador.id, date: dateStr, name: `${ambassador.firstName} ${ambassador.lastName}` });
  };

  const closeModal = () => setEditing(null);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const entry = { date: editing.date, status, note: status === 'OTHER' ? note : null };
      await availabilityAPI.setFor(editing.userId, [entry]);
      setDataByUser((prev) => ({
        ...prev,
        [editing.userId]: [
          ...(prev[editing.userId] || []).filter((d) => d.date.slice(0, 10) !== editing.date),
          entry,
        ],
      }));
      setEditing(null);
    } catch (err) {
      alert('Failed to save availability: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const modalLabel = editing
    ? `${editing.name} — ${new Date(`${editing.date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })}`
    : '';

  if (ambassadors.length === 0) {
    return <Card className="p-8"><EmptyState icon="🗓️" title="No ambassadors found" /></Card>;
  }

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
          <Button variant="secondary" size="sm" onClick={() => setWeekStart((w) => addDays(w, -7))}>
            ‹ Prev
          </Button>
          <div className="text-center">
            <div className="text-sm font-semibold text-slate-700">
              {formatShort(weekStart)} – {formatShort(weekEnd)}
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
          <Button variant="secondary" size="sm" onClick={() => setWeekStart((w) => addDays(w, 7))}>
            Next ›
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 min-w-[640px]">
            <thead>
              <tr>
                <th className="text-left text-xs font-medium text-slate-500 px-2 sticky left-0 bg-white">Ambassador</th>
                {weekDays.map((dateStr) => (
                  <th key={dateStr} className={`text-xs font-medium px-1 py-1 ${dateStr === todayStr() ? 'text-mint-700' : 'text-slate-500'}`}>
                    <div className="uppercase tracking-wide">
                      {new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}
                    </div>
                    <div>{new Date(`${dateStr}T00:00:00Z`).getUTCDate()}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ambassadors.map((a) => (
                <tr key={a.id}>
                  <td className="text-sm font-medium text-slate-700 px-2 whitespace-nowrap sticky left-0 bg-white">
                    {a.firstName} {a.lastName}
                  </td>
                  {weekDays.map((dateStr) => {
                    const day = (dataByUser[a.id] || []).find((d) => d.date.slice(0, 10) === dateStr);
                    const opt = statusOption(day?.status);
                    return (
                      <td key={dateStr} className="p-0.5">
                        <button
                          type="button"
                          title={opt ? `${opt.label}${day?.note ? `: ${day.note}` : ''}` : 'Not set'}
                          onClick={() => openCell(a, dateStr)}
                          className={`w-full h-9 rounded-md border transition-colors hover:brightness-95 ${opt ? opt.cell : NOT_SET_CELL}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={!!editing} onClose={closeModal} title={modalLabel}>
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
                  name="team-availability-status"
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
              label="What times can they work this day?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Only available after 3pm"
            />
          )}
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
