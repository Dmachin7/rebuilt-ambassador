import React, { useEffect, useRef, useState } from 'react';
import { eventsAPI, usersAPI, availabilityAPI, shiftsAPI } from '../api/index.js';
import { Button, Modal, Input, Textarea, Select } from './ui/index.jsx';
import { MapPin } from 'lucide-react';
import { autocompleteLocation } from '../stubs/maps.js';

const PICKUP_LOCATIONS = [
  'Rebuilt Downstairs Fridge',
  'Anytime Fitness Clearwater',
  'Anytime Fitness Tarpon Springs',
  'Bayshore Fit',
  'Burg CrossFit Downtown',
  'Burn Boot Camp Brandon',
  'Burn Boot Camp South Tampa',
  'Burn Boot Camp Apollo Beach',
  'Camp Tampa',
  'NOEQL',
  'CrossFit Brooksville',
  'CrossFit Manatee',
  'CrosssFit St. Pete',
  'Elevate St. Pete',
  'F45 Training Largo East',
  'F45 Training Riverview',
  'F45 Wiregrass',
  'F45 Midtown Tampa',
  'F45 Training Lakeland Heights',
  'F45 Training Sarasota UTC',
  'Fit24 Tampa',
  'Fit Body Boot Camp - Lutz',
  'Level Up Westchase',
  'MAXX Nutrition & Smoothies',
  'Nutrishop South Tampa',
  'Perform24',
  'Seven Springs Crossfit',
  'crossfit AERO',
  'Train Harder CrossFit',
  'TrYumph Fitness',
  'Sunshine City Crossfit',
];

const EMPTY_FORM = {
  title: '', location: '', pickupLocation: '', contactName: '', contactPhone: '', contactEmail: '',
  eventDate: '', startTime: '', endTime: '',
  setupTimeMins: 15, ambassadorsNeeded: 1,
  samplesNeeded: '', breakfastsNeeded: '', snackBitesNeeded: '', notes: '',
  hasImportantNotes: false, tentNeeded: false,
  baggedAndSent: false, baggedByUserId: '',
  assignedAmbassadorIds: [],
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

// Snack bites are only ever handed out in bags of 10
const roundToTen = (n) => Math.round(n / 10) * 10;

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

function TimeField({ label, value, onChange, required }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}{required && ' *'}
      </label>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-mint-400 focus:border-transparent"
      />
    </div>
  );
}

// Shared create/edit event form, used by both the Events list page (Add/Edit buttons) and the
// Event Calendar (click a date to create, double-click an event to edit).
export default function EventFormModal({ isOpen, onClose, editingEvent, initialDate, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ambassadors, setAmbassadors] = useState([]);
  const [staff, setStaff] = useState([]); // ADMIN/EVENT_COORDINATOR users, for the "Bagged By" dropdown
  const [assignMode, setAssignMode] = useState('open'); // 'open' | 'assign'
  const [distance, setDistance] = useState({ milesFromHq: '', driveTimeMins: '' });
  const [availabilityByAmbassador, setAvailabilityByAmbassador] = useState({});
  const [shifts, setShifts] = useState([]); // edit mode only — existing shifts on this event
  const [expandedShiftId, setExpandedShiftId] = useState(null);
  const [shiftAssignSaving, setShiftAssignSaving] = useState(false);

  // Reset the form whenever the modal opens, or the event/date it's editing/prefilling changes.
  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setAvailabilityByAmbassador({});
    usersAPI.list('AMBASSADOR').then(setAmbassadors).catch(() => {});
    usersAPI.list().then((all) => setStaff(all.filter((u) => u.role === 'ADMIN' || u.role === 'EVENT_COORDINATOR'))).catch(() => {});

    if (editingEvent) {
      setForm({
        title: editingEvent.title,
        location: editingEvent.location,
        pickupLocation: editingEvent.pickupLocation || '',
        contactName: editingEvent.contactName || '',
        contactPhone: editingEvent.contactPhone || '',
        contactEmail: editingEvent.contactEmail || '',
        eventDate: toLocalDate(editingEvent.date),
        startTime: toLocalTime(editingEvent.date),
        endTime: editingEvent.endTime ? toLocalTime(editingEvent.endTime) : '',
        setupTimeMins: editingEvent.setupTimeMins,
        ambassadorsNeeded: editingEvent.ambassadorsNeeded,
        samplesNeeded: editingEvent.samplesNeeded || '',
        breakfastsNeeded: editingEvent.breakfastsNeeded || '',
        snackBitesNeeded: editingEvent.snackBitesNeeded || '',
        notes: editingEvent.notes || '',
        hasImportantNotes: editingEvent.hasImportantNotes || false,
        tentNeeded: editingEvent.tentNeeded || false,
        baggedAndSent: editingEvent.baggedAndSent || false,
        baggedByUserId: editingEvent.baggedByUserId || '',
        assignedAmbassadorIds: [],
      });
      setDistance({ milesFromHq: editingEvent.milesFromHq ?? '', driveTimeMins: editingEvent.driveTimeMins ?? '' });
      setShifts(editingEvent.shifts || []);
    } else {
      setForm({ ...EMPTY_FORM, eventDate: initialDate || '' });
      setDistance({ milesFromHq: '', driveTimeMins: '' });
      setShifts([]);
    }
    setAssignMode('open');
    setExpandedShiftId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingEvent, initialDate]);

  // Look up each ambassador's set availability for the event's date, so the assignment list can be
  // filtered/annotated instead of relying on the ambassador's static (usually-stale) isAvailable flag.
  // Runs for the create-flow's "assign now" picker, and always in edit mode (Shifts & Ambassadors).
  useEffect(() => {
    const needsAvailability = editingEvent ? true : assignMode === 'assign';
    if (!needsAvailability || !form.eventDate || ambassadors.length === 0) return;
    let cancelled = false;
    Promise.all(ambassadors.map((a) => availabilityAPI.get(a.id, form.eventDate, form.eventDate)))
      .then((results) => {
        if (cancelled) return;
        const map = {};
        ambassadors.forEach((a, i) => { map[a.id] = results[i][0]; });
        setAvailabilityByAmbassador(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignMode, form.eventDate, ambassadors, editingEvent]);

  const handleSave = async () => {
    if (!form.title || !form.location || !form.eventDate) {
      setError('Title, location, and date are required');
      return;
    }
    if (distance.milesFromHq === '' || distance.driveTimeMins === '') {
      setError('Miles from HQ and drive time are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        baggedByUserId: form.baggedByUserId || null,
        date: combineDatetime(form.eventDate, form.startTime),
        endTime: form.endTime ? combineDatetime(form.eventDate, form.endTime) : null,
        milesFromHq: distance.milesFromHq,
        driveTimeMins: distance.driveTimeMins,
      };
      if (editingEvent) {
        await eventsAPI.update(editingEvent.id, payload);
      } else {
        payload.assignedAmbassadorIds = assignMode === 'assign' ? form.assignedAmbassadorIds : [];
        await eventsAPI.create(payload);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const f = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const set = (field) => (val) => setForm((prev) => ({ ...prev, [field]: val }));

  const toggleAmbassador = (id) => {
    const limit = parseInt(form.ambassadorsNeeded) || 1;
    setForm((prev) => {
      const current = prev.assignedAmbassadorIds;
      if (current.includes(id)) return { ...prev, assignedAmbassadorIds: current.filter((x) => x !== id) };
      if (current.length >= limit) return prev;
      return { ...prev, assignedAmbassadorIds: [...current, id] };
    });
  };

  // Edit mode — assign/reassign/remove an ambassador on an existing shift directly from this
  // modal, without needing to close it and go find the Event Detail or Calendar picker.
  const handleAssignShift = async (shiftId, ambassadorId) => {
    setShiftAssignSaving(true);
    try {
      const updated = await shiftsAPI.assign(shiftId, ambassadorId);
      setShifts((prev) => prev.map((s) => (s.id === shiftId ? updated : s)));
      setExpandedShiftId(null);
      onSaved?.();
    } catch (err) {
      alert(err.message);
    } finally {
      setShiftAssignSaving(false);
    }
  };

  const handleUnassignShift = async (shiftId) => {
    if (!confirm('Remove ambassador from this shift?')) return;
    try {
      await shiftsAPI.unassign(shiftId);
      setShifts((prev) => prev.map((s) => (s.id === shiftId ? { ...s, ambassador: null, ambassadorId: null, status: 'OPEN' } : s)));
      onSaved?.();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingEvent ? 'Edit Event' : 'New Event'} size="lg">
      <div className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg border border-red-200">{error}</div>}

        <Input label="Event Title *" value={form.title} onChange={f('title')} placeholder="e.g. Whole Foods Demo – South Austin" />

        <LocationAutocomplete
          value={form.location}
          onChange={(val) => { set('location')(val); setError(''); }}
        />

        <Select label="Pickup Location" value={form.pickupLocation} onChange={f('pickupLocation')}>
          <option value="">— Select —</option>
          {PICKUP_LOCATIONS.map((loc) => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </Select>

        <div className="rounded-lg p-3 space-y-3 border bg-slate-50 border-slate-200">
          <p className="text-xs text-slate-500">
            Round-trip miles and drive time (there and back) — look these up in Google Maps. Factored directly into mileage reimbursement and paid hours.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Round-Trip Miles *"
              type="number"
              min="0"
              step="0.1"
              value={distance.milesFromHq}
              onChange={(e) => setDistance((prev) => ({ ...prev, milesFromHq: e.target.value }))}
            />
            <Input
              label="Round-Trip Drive Time (mins) *"
              type="number"
              min="0"
              value={distance.driveTimeMins}
              onChange={(e) => setDistance((prev) => ({ ...prev, driveTimeMins: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
            <input
              type="date"
              value={form.eventDate}
              onChange={(e) => set('eventDate')(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-mint-400 focus:border-transparent"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TimeField label="Start Time" value={form.startTime} onChange={set('startTime')} required />
            <TimeField label="End Time" value={form.endTime} onChange={set('endTime')} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Ambassadors Needed" type="number" min="1" value={form.ambassadorsNeeded} onChange={f('ambassadorsNeeded')} />
          <Input label="Setup (mins)" type="number" min="0" value={form.setupTimeMins} onChange={f('setupTimeMins')} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Sample Meals" type="number" min="0" value={form.samplesNeeded}
            onChange={f('samplesNeeded')} placeholder="Optional" className="no-spinner"
          />
          <Input
            label="Sample Breakfasts" type="number" min="0" value={form.breakfastsNeeded}
            onChange={f('breakfastsNeeded')} placeholder="Optional" className="no-spinner"
          />
          <Input
            label="Snack Bites (10s)" type="number" min="0" step="10" value={form.snackBitesNeeded}
            onChange={f('snackBitesNeeded')}
            onBlur={() => form.snackBitesNeeded !== '' && set('snackBitesNeeded')(String(roundToTen(parseInt(form.snackBitesNeeded) || 0)))}
            placeholder="Optional" className="no-spinner"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
            form.hasImportantNotes ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:bg-slate-50'
          }`}>
            <input
              type="checkbox"
              checked={form.hasImportantNotes}
              onChange={(e) => set('hasImportantNotes')(e.target.checked)}
              className="accent-amber-500"
            />
            <span className="text-sm text-slate-700">⚠️ Important Notes</span>
          </label>
          <label className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
            form.tentNeeded ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
          }`}>
            <input
              type="checkbox"
              checked={form.tentNeeded}
              onChange={(e) => set('tentNeeded')(e.target.checked)}
              className="accent-blue-500"
            />
            <span className="text-sm text-slate-700">⛺ Tent Needed</span>
          </label>
        </div>

        <div className="bg-mint-50 rounded-lg px-3 py-2 text-xs text-slate-600">
          💰 Pay rate: <strong>$20/hr</strong> (fixed) — applied to event time, round-trip drive time, and setup time
        </div>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold text-slate-600 mb-3 uppercase tracking-wide">Event Contact</p>
          <div className="grid grid-cols-1 gap-3">
            <Input label="Name" value={form.contactName} onChange={f('contactName')} placeholder="Contact name" />
            <Input label="Phone" value={form.contactPhone} onChange={f('contactPhone')} placeholder="512-555-0000" />
            <Input label="Email" type="email" value={form.contactEmail} onChange={f('contactEmail')} placeholder="email@store.com" />
          </div>
        </div>

        <Textarea label="Notes" value={form.notes} onChange={f('notes')} rows={3} placeholder="Setup instructions, parking info, special notes..." />

        {/* Prep & delivery tracking — only meaningful once the event exists */}
        {editingEvent && (
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-600 mb-3 uppercase tracking-wide">Prep & Delivery</p>
            <label className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors mb-3 ${
              form.baggedAndSent ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:bg-slate-50'
            }`}>
              <input
                type="checkbox"
                checked={form.baggedAndSent}
                onChange={(e) => set('baggedAndSent')(e.target.checked)}
                className="accent-green-500"
              />
              <span className="text-sm text-slate-700">Bagged & Sent to Location</span>
            </label>
            <Select label="Bagged By" value={form.baggedByUserId} onChange={f('baggedByUserId')}>
              <option value="">— Select —</option>
              {staff.map((u) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
              ))}
            </Select>
          </div>
        )}

        {/* Shifts & Ambassadors — edit only (shifts don't exist yet during create) */}
        {editingEvent && (
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-600 mb-3 uppercase tracking-wide">
              Shifts & Ambassadors ({shifts.filter((s) => s.ambassadorId).length}/{shifts.length} filled)
            </p>
            {shifts.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No shifts on this event.</p>
            ) : (
              <div className="space-y-2">
                {shifts.map((shift) => (
                  <div key={shift.id} className="border border-slate-200 rounded-lg px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-700 truncate">
                        {shift.ambassador
                          ? `${shift.ambassador.firstName} ${shift.ambassador.lastName}`
                          : <span className="text-slate-400 italic">Open shift</span>}
                      </span>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => setExpandedShiftId((prev) => (prev === shift.id ? null : shift.id))}
                          className="text-xs text-mint-600 hover:text-mint-700 font-medium"
                        >
                          {shift.ambassador ? 'Change' : 'Assign'}
                        </button>
                        {shift.ambassador && (
                          <button
                            type="button"
                            onClick={() => handleUnassignShift(shift.id)}
                            className="text-xs text-slate-400 hover:text-red-500"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>

                    {expandedShiftId === shift.id && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                        {!form.eventDate ? (
                          <p className="text-xs text-slate-400 italic">Set the event date above to see availability.</p>
                        ) : ambassadors.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">No ambassadors found.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                            {ambassadors.map((amb) => {
                              const day = availabilityByAmbassador[amb.id];
                              const availLabel = day?.status === 'OPEN' ? 'Available'
                                : day?.status === 'OTHER' ? 'Limited'
                                : day?.status === 'UNAVAILABLE' ? 'Unavailable'
                                : 'Not set';
                              const availClass = day?.status === 'OPEN' ? 'bg-green-100 text-green-700'
                                : day?.status === 'OTHER' ? 'bg-amber-100 text-amber-700'
                                : day?.status === 'UNAVAILABLE' ? 'bg-red-100 text-red-600'
                                : 'bg-slate-100 text-slate-400';
                              const isCurrent = shift.ambassadorId === amb.id;
                              return (
                                <button
                                  type="button"
                                  key={amb.id}
                                  title={day?.status === 'OTHER' && day?.note ? day.note : undefined}
                                  onClick={() => handleAssignShift(shift.id, amb.id)}
                                  disabled={shiftAssignSaving || isCurrent}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors ${
                                    isCurrent ? 'border-mint-400 bg-mint-50' : 'border-slate-200 hover:border-mint-300 hover:bg-mint-50'
                                  }`}
                                >
                                  <span className="text-sm text-slate-700 flex-1 truncate">{amb.firstName} {amb.lastName}</span>
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${availClass}`}>{availLabel}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ambassador assignment — create only */}
        {!editingEvent && (
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-600 mb-3 uppercase tracking-wide">Ambassador Assignment</p>
            <div className="space-y-2 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="assignMode"
                  value="open"
                  checked={assignMode === 'open'}
                  onChange={() => { setAssignMode('open'); setForm((p) => ({ ...p, assignedAmbassadorIds: [] })); }}
                  className="accent-mint-600"
                />
                <span className="text-sm text-slate-700">Leave shifts open for pickup</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="assignMode"
                  value="assign"
                  checked={assignMode === 'assign'}
                  onChange={() => setAssignMode('assign')}
                  className="accent-mint-600"
                />
                <span className="text-sm text-slate-700">Assign ambassadors now</span>
              </label>
            </div>

            {assignMode === 'open' && (
              <p className="text-xs text-slate-400 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                All ambassadors will be notified by email about this new event.
              </p>
            )}

            {assignMode === 'assign' && (
              <div>
                {!form.eventDate ? (
                  <p className="text-xs text-slate-400 italic">Set the event date above to see who's available.</p>
                ) : (
                  <>
                    <p className="text-xs text-slate-500 mb-2">
                      Select up to <strong>{form.ambassadorsNeeded}</strong> ambassador{form.ambassadorsNeeded > 1 ? 's' : ''} — remaining shifts stay open. Only showing ambassadors who aren't marked unavailable on {form.eventDate}.
                    </p>
                    {(() => {
                      const shown = ambassadors.filter((amb) => availabilityByAmbassador[amb.id]?.status !== 'UNAVAILABLE');
                      if (shown.length === 0) {
                        return <p className="text-xs text-slate-400 italic">No ambassadors available on this date.</p>;
                      }
                      return (
                        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                          {shown.map((amb) => {
                            const selected = form.assignedAmbassadorIds.includes(amb.id);
                            const limit = parseInt(form.ambassadorsNeeded) || 1;
                            const atLimit = form.assignedAmbassadorIds.length >= limit && !selected;
                            const day = availabilityByAmbassador[amb.id];
                            const availLabel = day?.status === 'OPEN' ? 'Available' : day?.status === 'OTHER' ? 'Limited' : 'Not set';
                            const availClass = day?.status === 'OPEN'
                              ? 'bg-green-100 text-green-700'
                              : day?.status === 'OTHER'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-400';
                            return (
                              <label
                                key={amb.id}
                                title={day?.status === 'OTHER' && day?.note ? day.note : undefined}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                                  selected
                                    ? 'border-mint-400 bg-mint-50'
                                    : atLimit
                                    ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                                    : 'border-slate-200 hover:border-mint-300 hover:bg-mint-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  disabled={atLimit}
                                  onChange={() => toggleAmbassador(amb.id)}
                                  className="accent-mint-600"
                                />
                                <span className="text-sm text-slate-700 flex-1">
                                  {amb.firstName} {amb.lastName}
                                </span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${availClass}`}>
                                  {availLabel}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </>
                )}
                {form.assignedAmbassadorIds.length < (parseInt(form.ambassadorsNeeded) || 1) && (
                  <p className="text-xs text-slate-400 mt-2">
                    {(parseInt(form.ambassadorsNeeded) || 1) - form.assignedAmbassadorIds.length} open shift{((parseInt(form.ambassadorsNeeded) || 1) - form.assignedAmbassadorIds.length) !== 1 ? 's' : ''} will be left open — all ambassadors will be notified.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editingEvent ? 'Save Changes' : 'Create Event'}</Button>
        </div>
      </div>
    </Modal>
  );
}
