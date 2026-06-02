import React, { useEffect, useState } from 'react';
import { usersAPI } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Card, Button, Spinner, EmptyState } from '../../components/ui/index.jsx';
import { Phone, Mail, UserPlus, X, Trash2, Copy, Check } from 'lucide-react';

function InviteModal({ role, onClose, onCreated }) {
  const isAdmin = role === 'ADMIN';
  const label = isAdmin ? 'Admin' : 'Event Coordinator';

  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const f = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.firstName || !form.lastName || !form.email) {
      setError('First name, last name, and email are required.');
      return;
    }
    setSaving(true);
    try {
      const res = await usersAPI.create({ ...form, role });
      setResult(res);
      onCreated(res.user);
    } catch (err) {
      setError(err.message || `Failed to create ${label.toLowerCase()}.`);
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(result.setPasswordUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Add {label}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        {result ? (
          <div className="px-5 py-6 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-green-700 mb-1">Account created!</p>
              <p className="text-xs text-green-600">
                Send {result.user.firstName} the invite link below — they'll set their own password.
              </p>
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
            </div>
            {result.setPasswordUrl && (
              <div>
                <p className="text-xs font-medium text-slate-600 mb-1.5">Invite link (expires in 72 hours):</p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
                  <span className="text-xs text-slate-600 flex-1 truncate font-mono">{result.setPasswordUrl}</span>
                  <button onClick={copyLink} className="flex-shrink-0 text-slate-400 hover:text-slate-700 transition">
                    {copied ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">Copy and send this to {result.user.firstName} via text or email.</p>
              </div>
            )}
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
                <input className="input-field text-sm" value={form.firstName} onChange={f('firstName')} placeholder="First" />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Last Name *</label>
                <input className="input-field text-sm" value={form.lastName} onChange={f('lastName')} placeholder="Last" />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Email *</label>
              <input type="email" className="input-field text-sm" value={form.email} onChange={f('email')} placeholder="name@example.com" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Phone</label>
              <input type="tel" className="input-field text-sm" value={form.phone} onChange={f('phone')} placeholder="512-555-0100" />
            </div>
            <p className="text-xs text-slate-400 pt-1">
              They'll get an invite link to set their own password.
            </p>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? 'Creating...' : 'Create & Get Invite Link'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function StaffCard({ person, roleLabel, accentClass, onDelete, isSelf }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${accentClass}`}>
          {person.firstName[0]}{person.lastName?.[0] || ''}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800">
            {person.firstName} {person.lastName}
            {isSelf && <span className="ml-1.5 text-xs text-slate-400">(you)</span>}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">{roleLabel}</div>
        </div>
      </div>
      <div className="space-y-1.5 mb-4">
        <a href={`mailto:${person.email}`} className="flex items-center gap-2 text-slate-500 hover:text-mint-600 text-xs">
          <Mail size={13} /> {person.email}
        </a>
        {person.phone && (
          <a href={`tel:${person.phone}`} className="flex items-center gap-2 text-slate-500 hover:text-mint-600 text-xs">
            <Phone size={13} /> {person.phone}
          </a>
        )}
      </div>
      <div className="text-xs text-slate-400">
        Added {new Date(person.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
      </div>
      {!isSelf && (
        <button
          onClick={() => onDelete(person)}
          className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg py-1.5 transition"
        >
          <Trash2 size={13} /> Remove
        </button>
      )}
    </Card>
  );
}

export default function AdminStaff() {
  const { user: currentUser } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [coordinators, setCoordinators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(null); // 'ADMIN' | 'EVENT_COORDINATOR' | null
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([
      usersAPI.list('ADMIN'),
      usersAPI.list('EVENT_COORDINATOR'),
    ]).then(([a, c]) => {
      setAdmins(a);
      setCoordinators(c);
    }).finally(() => setLoading(false));
  }, []);

  const handleCreated = (newUser) => {
    if (newUser.role === 'ADMIN') setAdmins((prev) => [newUser, ...prev]);
    else setCoordinators((prev) => [newUser, ...prev]);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await usersAPI.delete(confirmDelete.id);
      if (confirmDelete.role === 'ADMIN') setAdmins((prev) => prev.filter((u) => u.id !== confirmDelete.id));
      else setCoordinators((prev) => prev.filter((u) => u.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (err) {
      alert(err.message || 'Failed to remove.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Staff</h1>
        <p className="text-sm text-slate-500">Manage admins and event coordinators</p>
      </div>

      {/* Admins */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-700">Admins</h2>
            <p className="text-xs text-slate-400">{admins.length} admin{admins.length !== 1 ? 's' : ''}</p>
          </div>
          <Button onClick={() => setAddModal('ADMIN')} className="flex items-center gap-2 text-sm py-1.5">
            <UserPlus size={15} /> Add Admin
          </Button>
        </div>
        {admins.length === 0 ? (
          <Card className="p-6">
            <EmptyState icon="🔑" title="No admins" description="Add an admin account" />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {admins.map((a) => (
              <StaffCard
                key={a.id}
                person={a}
                roleLabel="Admin"
                accentClass="bg-purple-100 text-purple-700"
                onDelete={setConfirmDelete}
                isSelf={a.id === currentUser?.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Event Coordinators */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-700">Event Coordinators</h2>
            <p className="text-xs text-slate-400">{coordinators.length} coordinator{coordinators.length !== 1 ? 's' : ''}</p>
          </div>
          <Button onClick={() => setAddModal('EVENT_COORDINATOR')} className="flex items-center gap-2 text-sm py-1.5">
            <UserPlus size={15} /> Add Coordinator
          </Button>
        </div>
        {coordinators.length === 0 ? (
          <Card className="p-6">
            <EmptyState icon="👤" title="No event coordinators yet" description="Add your first Event Coordinator to get started" />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {coordinators.map((c) => (
              <StaffCard
                key={c.id}
                person={c}
                roleLabel="Event Coordinator"
                accentClass="bg-blue-100 text-blue-700"
                onDelete={setConfirmDelete}
                isSelf={false}
              />
            ))}
          </div>
        )}
      </section>

      {addModal && (
        <InviteModal
          role={addModal}
          onClose={() => setAddModal(null)}
          onCreated={handleCreated}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-slate-800 mb-1">Remove {confirmDelete.role === 'ADMIN' ? 'Admin' : 'Coordinator'}?</h3>
            <p className="text-sm text-slate-500 mb-5">
              <span className="font-medium text-slate-700">{confirmDelete.firstName} {confirmDelete.lastName}</span> will lose access to the platform immediately.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancel</Button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition"
              >
                {deleting ? 'Removing...' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
