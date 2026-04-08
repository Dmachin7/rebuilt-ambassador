import React, { useEffect, useState } from 'react';
import { usersAPI, shiftsAPI } from '../../api/index.js';
import { Card, Button, Spinner, EmptyState } from '../../components/ui/index.jsx';
import { formatCurrency, formatHours } from '../../utils/formatters.js';
import { Phone, Mail, UserPlus, X, Eye, EyeOff } from 'lucide-react';

function AddAmbassadorModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const f = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.firstName || !form.lastName || !form.email || !form.password) {
      setError('First name, last name, email, and password are required.');
      return;
    }
    setSaving(true);
    try {
      const res = await usersAPI.create(form);
      setResult(res);
      onCreated(res.user);
    } catch (err) {
      setError(err.message || 'Failed to create ambassador.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Add Brand Ambassador</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        {result ? (
          <div className="px-5 py-6 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-green-700 mb-1">Account created!</p>
              <p className="text-xs text-green-600">Share these credentials with the ambassador — the password won't be shown again.</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center bg-slate-50 rounded-lg px-3 py-2">
                <span className="text-slate-500">Name</span>
                <span className="font-medium text-slate-800">{result.user.firstName} {result.user.lastName}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 rounded-lg px-3 py-2">
                <span className="text-slate-500">Email</span>
                <span className="font-medium text-slate-800">{result.user.email}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 rounded-lg px-3 py-2">
                <span className="text-slate-500">Password</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium text-slate-800">
                    {showPassword ? result.plainPassword : '••••••••'}
                  </span>
                  <button onClick={() => setShowPassword(!showPassword)} className="text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400">Stub: real implementation will email credentials via SendGrid/Nodemailer</p>
            <Button className="w-full" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-lg">{error}</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">First Name *</label>
                <input className="input-field text-sm" value={form.firstName} onChange={f('firstName')} placeholder="Jessica" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Last Name *</label>
                <input className="input-field text-sm" value={form.lastName} onChange={f('lastName')} placeholder="Rivera" />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Email *</label>
              <input type="email" className="input-field text-sm" value={form.email} onChange={f('email')} placeholder="jessica@example.com" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Phone</label>
              <input type="tel" className="input-field text-sm" value={form.phone} onChange={f('phone')} placeholder="512-555-0100" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Password *</label>
              <input type="text" className="input-field text-sm font-mono" value={form.password} onChange={f('password')} placeholder="Set a temporary password" />
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? 'Creating...' : 'Create Account'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AdminAmbassadors() {
  const [ambassadors, setAmbassadors] = useState([]);
  const [hours, setHours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    Promise.all([usersAPI.list('AMBASSADOR'), shiftsAPI.hours()])
      .then(([ambs, hrs]) => {
        setAmbassadors(ambs);
        setHours(hrs);
      })
      .finally(() => setLoading(false));
  }, []);

  const getStats = (ambId) => hours.find((h) => h.ambassador?.id === ambId) || { totalHours: 0, totalEarnings: 0, shiftCount: 0 };

  const handleCreated = (newUser) => {
    setAmbassadors((prev) => [newUser, ...prev]);
    setShowAddModal(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ambassadors</h1>
          <p className="text-sm text-slate-500">{ambassadors.length} brand ambassadors</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2">
          <UserPlus size={16} /> Add Ambassador
        </Button>
      </div>

      {ambassadors.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon="👥"
            title="No ambassadors yet"
            description="Add your first Brand Ambassador to get started"
            action={<Button onClick={() => setShowAddModal(true)}><UserPlus size={15} /> Add Ambassador</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ambassadors.map((amb) => {
            const stats = getStats(amb.id);
            return (
              <Card key={amb.id} className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-mint-100 rounded-full flex items-center justify-center text-sm font-bold text-mint-700">
                    {amb.firstName[0]}{amb.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800">{amb.firstName} {amb.lastName}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${amb.isAvailable ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {amb.isAvailable ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-sm mb-4">
                  <a href={`mailto:${amb.email}`} className="flex items-center gap-2 text-slate-500 hover:text-mint-600 text-xs">
                    <Mail size={13} /> {amb.email}
                  </a>
                  {amb.phone && (
                    <a href={`tel:${amb.phone}`} className="flex items-center gap-2 text-slate-500 hover:text-mint-600 text-xs">
                      <Phone size={13} /> {amb.phone}
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-lg p-3 mb-3">
                  <div className="text-center">
                    <div className="text-lg font-bold text-slate-800">{stats.shiftCount}</div>
                    <div className="text-xs text-slate-500">Shifts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-base font-bold text-slate-800">{formatHours(stats.totalHours)}</div>
                    <div className="text-xs text-slate-500">Hours</div>
                  </div>
                  <div className="text-center">
                    <div className="text-base font-bold text-mint-600">{formatCurrency(stats.totalEarnings)}</div>
                    <div className="text-xs text-slate-500">Earned</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Lifetime sales: <span className="font-medium text-slate-600">{amb.lifetimeSalesCount || 0}</span></span>
                  <span>Joined {new Date(amb.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <AddAmbassadorModal
          onClose={() => setShowAddModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
