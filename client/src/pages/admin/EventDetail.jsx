import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { eventsAPI, shiftsAPI, usersAPI } from '../../api/index.js';
import { Card, Button, Badge, Modal, Select, Spinner } from '../../components/ui/index.jsx';
import { formatCurrency, formatDateTime, formatDate, formatHours } from '../../utils/formatters.js';
import { ArrowLeft, MapPin, Phone, Mail, Clock, Users, UserPlus, MessageSquare } from 'lucide-react';

export default function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [ambassadors, setAmbassadors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignModal, setAssignModal] = useState(null);
  const [selectedAmb, setSelectedAmb] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [ev, ambs] = await Promise.all([
      eventsAPI.get(id),
      usersAPI.list('AMBASSADOR'),
    ]);
    setEvent(ev);
    setAmbassadors(ambs);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const handleAssign = async () => {
    if (!selectedAmb) return;
    setSaving(true);
    try {
      await shiftsAPI.assign(assignModal.id, selectedAmb);
      setAssignModal(null);
      setSelectedAmb('');
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async (shiftId) => {
    if (!confirm('Remove ambassador from this shift?')) return;
    await shiftsAPI.unassign(shiftId);
    load();
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;
  if (!event) return <div className="text-center py-20 text-slate-500">Event not found</div>;

  const assignedShifts = event.shifts.filter((s) => s.ambassadorId);
  const openShifts = event.shifts.filter((s) => !s.ambassadorId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/events" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">{event.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge status={event.status} />
            {event.milesFromHq && (
              <span className="text-xs text-slate-400">{event.milesFromHq} mi · {event.driveTimeMins} min drive</span>
            )}
          </div>
        </div>
        <Link to={`/admin/messages/${event.id}`}>
          <Button variant="secondary" size="sm"><MessageSquare size={14} /> Chat</Button>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Event info */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5">
            <h2 className="font-semibold text-slate-700 mb-4 text-sm uppercase tracking-wide">Event Details</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <MapPin size={15} className="text-slate-400 mt-0.5 shrink-0" />
                <span className="text-slate-700">{event.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-slate-400 shrink-0" />
                <span className="text-slate-700">{formatDateTime(event.date)}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-slate-800">{event.setupTimeMins}</div>
                  <div className="text-xs text-slate-500">Setup mins</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-slate-800">{event.breakdownTimeMins}</div>
                  <div className="text-xs text-slate-500">Breakdown mins</div>
                </div>
                <div className="bg-mint-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-mint-700">$20/hr</div>
                  <div className="text-xs text-slate-500">Pay rate</div>
                </div>
              </div>
              {event.samplesNeeded && (
                <div className="text-slate-600 text-xs">📦 {event.samplesNeeded} samples needed</div>
              )}
              {event.notes && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-slate-500 mb-1">Notes</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line">{event.notes}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Shifts */}
          <Card className="overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-700 text-sm">Shifts ({event.shifts.length})</h2>
              <span className="text-xs text-slate-400">{assignedShifts.length}/{event.shifts.length} filled</span>
            </div>
            <div className="divide-y divide-slate-50">
              {event.shifts.map((shift) => (
                <div key={shift.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    {shift.ambassador ? (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-mint-100 rounded-full flex items-center justify-center text-xs font-medium text-mint-700">
                          {shift.ambassador.firstName[0]}{shift.ambassador.lastName[0]}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-700">
                            {shift.ambassador.firstName} {shift.ambassador.lastName}
                          </div>
                          {shift.checkinTime && (
                            <div className="text-xs text-slate-400">
                              In: {formatDateTime(shift.checkinTime)}
                              {shift.checkoutTime && ` · Out: ${formatDateTime(shift.checkoutTime)}`}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400 italic">Open shift</span>
                    )}
                    {shift.report && (
                      <div className="mt-1 text-xs text-green-600">✓ Report submitted · {shift.report.salesCount} sales · {shift.report.signupsCount} sign-ups</div>
                    )}
                    {shift.payment && (
                      <div className="mt-0.5 text-xs text-slate-400">
                        Pay: {formatCurrency(shift.payment.amount)} ({formatHours(shift.payment.hoursWorked)}) · <Badge status={shift.payment.status} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge status={shift.status} />
                    {shift.ambassador ? (
                      <button onClick={() => handleUnassign(shift.id)} className="text-xs text-slate-400 hover:text-red-500">Remove</button>
                    ) : (
                      <button onClick={() => { setAssignModal(shift); setSelectedAmb(''); }} className="text-xs text-mint-600 hover:text-mint-700 flex items-center gap-1">
                        <UserPlus size={12} /> Assign
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Reports */}
          {event.shifts.some((s) => s.report) && (
            <Card className="overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <h2 className="font-semibold text-slate-700 text-sm">Post-Event Reports</h2>
              </div>
              <div className="divide-y divide-slate-50">
                {event.shifts.filter((s) => s.report).map((shift) => (
                  <div key={shift.id} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">
                        {shift.ambassador?.firstName} {shift.ambassador?.lastName}
                      </span>
                      <div className="flex gap-3 text-xs text-slate-500">
                        <span>🛒 {shift.report.salesCount} sales</span>
                        <span>✋ {shift.report.signupsCount} sign-ups</span>
                        {shift.report.mealsPerSale && <span>🍽 {shift.report.mealsPerSale} meals/sale</span>}
                      </div>
                    </div>
                    <p className="text-sm text-slate-600">{shift.report.feedback}</p>
                    {shift.report.issues && (
                      <p className="text-xs text-orange-600 mt-1">⚠️ {shift.report.issues}</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Contact sidebar */}
        <div className="space-y-4">
          {(event.contactName || event.contactPhone || event.contactEmail) && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Event Contact</h3>
              <div className="space-y-2 text-sm">
                {event.contactName && <div className="font-medium text-slate-800">{event.contactName}</div>}
                {event.contactPhone && (
                  <a href={`tel:${event.contactPhone}`} className="flex items-center gap-2 text-slate-500 hover:text-mint-600">
                    <Phone size={13} /> {event.contactPhone}
                  </a>
                )}
                {event.contactEmail && (
                  <a href={`mailto:${event.contactEmail}`} className="flex items-center gap-2 text-slate-500 hover:text-mint-600 text-xs">
                    <Mail size={13} /> {event.contactEmail}
                  </a>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      <Modal isOpen={!!assignModal} onClose={() => setAssignModal(null)} title="Assign Ambassador">
        <div className="space-y-4">
          <Select label="Select Ambassador" value={selectedAmb} onChange={(e) => setSelectedAmb(e.target.value)}>
            <option value="">— Choose an ambassador —</option>
            {ambassadors.map((a) => (
              <option key={a.id} value={a.id}>{a.firstName} {a.lastName} ({a.email})</option>
            ))}
          </Select>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setAssignModal(null)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={!selectedAmb || saving}>
              {saving ? 'Assigning...' : 'Assign'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
