import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { usersAPI, pickupLocationsAPI } from '../../api/index.js';
import { Card, Button, Spinner } from '../../components/ui/index.jsx';
import { Pencil, Trash2 } from 'lucide-react';

// Which email categories exist, and which roles can actually ever receive them — the underlying
// routes only ever query ADMIN for check-ins/checkouts/daily/weekly summaries, so an EC's toggle
// for those would be inert. Hide inert toggles rather than show a setting that does nothing.
const CATEGORIES = [
  { key: 'notifyShiftClaims', label: 'Shift Claimed / Dropped', description: 'An ambassador claims or drops an open shift.', roles: ['ADMIN', 'EVENT_COORDINATOR'] },
  { key: 'notifyMessages', label: 'New Messages', description: 'Someone posts in an event’s message thread.', roles: ['ADMIN', 'EVENT_COORDINATOR'] },
  { key: 'notifyEventRecaps', label: 'Event Recaps', description: 'An event is marked completed.', roles: ['ADMIN', 'EVENT_COORDINATOR'] },
  { key: 'notifyCheckIns', label: 'Ambassador Check-Ins', description: 'An ambassador checks in to a shift.', roles: ['ADMIN'] },
  { key: 'notifyCheckOuts', label: 'Ambassador Check-Outs', description: 'An ambassador checks out of a shift.', roles: ['ADMIN'] },
  { key: 'notifySalesReports', label: 'Sales Reports', description: 'A post-event sales report is submitted and needs verification.', roles: ['ADMIN'] },
  { key: 'notifyDailySummary', label: 'Daily Summary', description: 'The end-of-day summary email.', roles: ['ADMIN'] },
  { key: 'notifyWeeklySummary', label: 'Weekly Summary', description: 'The weekly summary email.', roles: ['ADMIN'] },
];

// Manages the options shown in the event form's "Pickup Location" dropdown. Event.pickupLocation
// is a plain string (not a foreign key to this list), so renaming here propagates to existing
// events via the server route — deleting only removes it as a future option.
function PickupLocationsCard() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

  const sortByName = (list) => [...list].sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    pickupLocationsAPI.list().then((list) => setLocations(sortByName(list))).finally(() => setLoading(false));
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setError('');
    setAdding(true);
    try {
      const created = await pickupLocationsAPI.create(newName.trim());
      setLocations((prev) => sortByName([...prev, created]));
      setNewName('');
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (loc) => {
    setEditingId(loc.id);
    setEditingName(loc.name);
    setError('');
  };

  const handleRename = async (id) => {
    if (!editingName.trim()) return;
    setError('');
    setSaving(true);
    try {
      const updated = await pickupLocationsAPI.update(id, editingName.trim());
      setLocations((prev) => sortByName(prev.map((l) => (l.id === id ? updated : l))));
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (loc) => {
    if (!confirm(`Remove "${loc.name}" from the pickup location list? Events already using it keep the text as-is — this only removes it as a future option.`)) return;
    setDeletingId(loc.id);
    try {
      await pickupLocationsAPI.delete(loc.id);
      setLocations((prev) => prev.filter((l) => l.id !== loc.id));
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-slate-700 mb-1 text-sm uppercase tracking-wide">Pickup Locations</h2>
      <p className="text-xs text-slate-400 mb-4">
        Manage the options in the "Pickup Location" dropdown when creating or editing an event. Renaming a location here also updates every event already using it.
      </p>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-lg mb-3">{error}</div>}

      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add a new pickup location..."
          className="input-field text-sm flex-1"
        />
        <Button type="submit" size="sm" disabled={adding || !newName.trim()}>
          {adding ? 'Adding...' : 'Add'}
        </Button>
      </form>

      {loading ? (
        <div className="flex justify-center py-6"><Spinner className="w-6 h-6" /></div>
      ) : (
        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {locations.map((loc) => (
            <div key={loc.id} className="flex items-center gap-2 py-2">
              {editingId === loc.id ? (
                <>
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="input-field text-sm flex-1 py-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(loc.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <Button size="sm" onClick={() => handleRename(loc.id)} disabled={saving}>Save</Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditingId(null)} disabled={saving}>Cancel</Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-slate-700">{loc.name}</span>
                  <button onClick={() => startEdit(loc)} className="text-slate-400 hover:text-mint-600 p-1" title="Rename">
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(loc)}
                    disabled={deletingId === loc.id}
                    className="text-slate-400 hover:text-red-500 p-1 disabled:opacity-50"
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
          {locations.length === 0 && (
            <p className="text-sm text-slate-400 py-4 text-center">No pickup locations yet — add one above.</p>
          )}
        </div>
      )}
    </Card>
  );
}

export default function AdminSettings() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    usersAPI.get(user.id).then(setPrefs).finally(() => setLoading(false));
  }, [user.id]);

  const toggle = (key) => {
    setSaved(false);
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const payload = {};
      CATEGORIES.forEach((c) => { payload[c.key] = prefs[c.key]; });
      await usersAPI.update(user.id, payload);
      setSaved(true);
    } catch (err) {
      alert('Failed to save preferences: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !prefs) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;

  const visible = CATEGORIES.filter((c) => c.roles.includes(user.role));

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500">Choose which email notifications you personally receive.</p>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold text-slate-700 mb-1 text-sm uppercase tracking-wide">Notification Preferences</h2>
        <p className="text-xs text-slate-400 mb-4">These only affect emails sent to your account — other admins and coordinators set their own.</p>
        <div className="divide-y divide-slate-100">
          {visible.map((c) => (
            <label key={c.key} className="flex items-start gap-3 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!!prefs[c.key]}
                onChange={() => toggle(c.key)}
                className="accent-mint-600 mt-0.5"
              />
              <div>
                <div className="text-sm font-medium text-slate-700">{c.label}</div>
                <div className="text-xs text-slate-400">{c.description}</div>
              </div>
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3 pt-4 mt-2 border-t border-slate-100">
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Preferences'}</Button>
          {saved && <span className="text-xs text-mint-600">Saved</span>}
        </div>
      </Card>

      <PickupLocationsCard />
    </div>
  );
}
