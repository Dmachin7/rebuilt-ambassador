import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { usersAPI } from '../../api/index.js';
import { Card, Button, Spinner } from '../../components/ui/index.jsx';

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
    </div>
  );
}
