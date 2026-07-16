import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { eventsAPI, shiftsAPI, usersAPI, reportsAPI } from '../../api/index.js';
import { Card, Button, Badge, Modal, Select, Input, Textarea, Spinner } from '../../components/ui/index.jsx';
import { formatCurrency, formatDateTime, formatDate, formatHours, formatTime } from '../../utils/formatters.js';
import { ArrowLeft, MapPin, Package, Phone, Mail, Clock, Users, UserPlus, MessageSquare, Pencil, Plus, Trash2 } from 'lucide-react';

const COMMISSION_UNDER = 20;
const COMMISSION_OVER = 40;
let nextSaleId = 0;

// datetime-local <input> needs "YYYY-MM-DDTHH:mm" in the browser's local time
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [ambassadors, setAmbassadors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignModal, setAssignModal] = useState(null);
  const [selectedAmb, setSelectedAmb] = useState('');
  const [saving, setSaving] = useState(false);

  const [editShiftId, setEditShiftId] = useState(null);
  const [editTimes, setEditTimes] = useState({ checkinTime: '', checkoutTime: '' });
  const [savingTimes, setSavingTimes] = useState(false);
  const [timesError, setTimesError] = useState('');
  const [reportForm, setReportForm] = useState({ feedback: '', issues: '', mealsSold: '' });
  const [sales, setSales] = useState([]);
  const [savingReport, setSavingReport] = useState(false);
  const [reportError, setReportError] = useState('');

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

  const handleAdminCheckin = async (shiftId) => {
    if (!confirm('Check in this ambassador now?')) return;
    try {
      await shiftsAPI.checkin(shiftId, new FormData());
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAdminCheckout = async (shiftId) => {
    if (!confirm('Check out this ambassador now?')) return;
    try {
      await shiftsAPI.checkout(shiftId);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const openEdit = (shift) => {
    setEditShiftId(shift.id);
    setEditTimes({ checkinTime: toLocalInput(shift.checkinTime), checkoutTime: toLocalInput(shift.checkoutTime) });
    setTimesError('');
    setReportForm({ feedback: '', issues: '', mealsSold: '' });
    setSales([]);
    setReportError('');
  };

  const handleSaveTimes = async () => {
    setSavingTimes(true);
    setTimesError('');
    try {
      await shiftsAPI.setAdminTimes(editShiftId, {
        checkinTime: editTimes.checkinTime ? new Date(editTimes.checkinTime).toISOString() : null,
        checkoutTime: editTimes.checkoutTime ? new Date(editTimes.checkoutTime).toISOString() : null,
      });
      await load();
    } catch (err) {
      setTimesError(err.message);
    } finally {
      setSavingTimes(false);
    }
  };

  const addSale = () => setSales((prev) => [...prev, { id: nextSaleId++, overThreshold: false }]);
  const removeSale = (saleId) => setSales((prev) => prev.filter((s) => s.id !== saleId));
  const toggleSale = (saleId) => setSales((prev) => prev.map((s) => (s.id === saleId ? { ...s, overThreshold: !s.overThreshold } : s)));

  const handleSaveReport = async () => {
    if (!reportForm.feedback.trim()) { setReportError('Feedback is required'); return; }
    setSavingReport(true);
    setReportError('');
    try {
      await reportsAPI.create({
        shiftId: editShiftId,
        feedback: reportForm.feedback,
        issues: reportForm.issues || undefined,
        mealsSold: reportForm.mealsSold || 0,
        sales: sales.map((s) => ({ overThreshold: s.overThreshold })),
      });
      await load();
    } catch (err) {
      setReportError(err.message);
    } finally {
      setSavingReport(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;
  if (!event) return <div className="text-center py-20 text-slate-500">Event not found</div>;

  const assignedShifts = event.shifts.filter((s) => s.ambassadorId);
  const openShifts = event.shifts.filter((s) => !s.ambassadorId);
  const editingShift = event.shifts.find((s) => s.id === editShiftId) || null;
  const editAvgMeals =
    reportForm.mealsSold && sales.length > 0
      ? (parseInt(reportForm.mealsSold) / sales.length).toFixed(1)
      : null;
  const editEstimatedCommission = sales.reduce((s, sale) => s + (sale.overThreshold ? COMMISSION_OVER : COMMISSION_UNDER), 0);

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
              <span className="text-xs text-slate-400">{event.milesFromHq} mi · {event.driveTimeMins} min drive (round-trip)</span>
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
              {event.pickupLocation && (
                <div className="flex items-start gap-2">
                  <Package size={15} className="text-slate-400 mt-0.5 shrink-0" />
                  <span className="text-slate-700">Pickup: {event.pickupLocation}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-slate-400 shrink-0" />
                <span className="text-slate-700">{formatDateTime(event.date)}</span>
                {event.endTime && (
                  <span className="text-slate-400 text-xs">→ {formatDateTime(event.endTime)}</span>
                )}
              </div>
              {event.setupTimeMins > 0 && event.arrivalTime && (
                <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                  <Clock size={14} className="text-orange-500 shrink-0" />
                  <span className="text-orange-700 text-sm font-medium">Ambassador arrival: {formatTime(event.arrivalTime)}</span>
                  <span className="text-orange-500 text-xs">({event.setupTimeMins} min setup before start)</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-slate-800">{event.setupTimeMins}</div>
                  <div className="text-xs text-slate-500">Setup mins</div>
                </div>
                <div className="bg-mint-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-mint-700">$20/hr</div>
                  <div className="text-xs text-slate-500">Pay rate</div>
                </div>
              </div>
              {(event.samplesNeeded || event.snackBitesNeeded) && (
                <div className="flex gap-4 text-slate-600 text-xs">
                  {event.samplesNeeded && <span>📦 {event.samplesNeeded} sample meals</span>}
                  {event.snackBitesNeeded && <span>🍬 {event.snackBitesNeeded} snack bites</span>}
                </div>
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
                              {shift.checkedInByAdmin && (
                                <span className="ml-1.5 text-orange-500 font-medium">· 👤 checked in by admin</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400 italic">Open shift</span>
                    )}
                    {shift.report && (
                      <div className="mt-1 text-xs text-green-600">✓ Report submitted · {shift.report.totalSales} sales · {shift.report.mealsSold} meals sold</div>
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
                      <>
                        {!shift.checkinTime && (
                          <button onClick={() => handleAdminCheckin(shift.id)} className="text-xs text-mint-600 hover:text-mint-700">Check In</button>
                        )}
                        {shift.checkinTime && !shift.checkoutTime && (
                          <button onClick={() => handleAdminCheckout(shift.id)} className="text-xs text-yellow-600 hover:text-yellow-700">Check Out</button>
                        )}
                        <button onClick={() => openEdit(shift)} className="text-xs text-slate-400 hover:text-mint-600 flex items-center gap-1">
                          <Pencil size={11} /> Edit
                        </button>
                        <button onClick={() => handleUnassign(shift.id)} className="text-xs text-slate-400 hover:text-red-500">Remove</button>
                      </>
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
                      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>🛒 {shift.report.totalSales} sales</span>
                        <span>🍽 {shift.report.mealsSold} meals sold</span>
                        {shift.report.mealsPerSale && <span>{shift.report.mealsPerSale} meals/sale</span>}
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

      {/* Edit Shift Modal — backfill check-in/out times and sales report for shifts that had app issues */}
      <Modal isOpen={!!editingShift} onClose={() => setEditShiftId(null)} title="Edit Shift" size="lg">
        {editingShift && (
          <div className="space-y-5">
            <p className="text-sm text-slate-500">
              {editingShift.ambassador?.firstName} {editingShift.ambassador?.lastName} — {event.title}
            </p>

            <Card className="p-4 space-y-3">
              <p className="text-sm font-medium text-slate-700">Check-in / Check-out Times</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input
                  label="Check-in"
                  type="datetime-local"
                  value={editTimes.checkinTime}
                  onChange={(e) => setEditTimes({ ...editTimes, checkinTime: e.target.value })}
                />
                <Input
                  label="Check-out"
                  type="datetime-local"
                  value={editTimes.checkoutTime}
                  onChange={(e) => setEditTimes({ ...editTimes, checkoutTime: e.target.value })}
                />
              </div>
              {timesError && <div className="text-sm text-red-600">{timesError}</div>}
              <Button onClick={handleSaveTimes} disabled={savingTimes} size="sm">
                {savingTimes ? 'Saving...' : 'Save Times'}
              </Button>
            </Card>

            {editingShift.report ? (
              <Card className="p-4">
                <p className="text-sm font-medium text-slate-700 mb-1">Report already submitted</p>
                <p className="text-xs text-slate-500">{editingShift.report.totalSales} sales · {editingShift.report.mealsSold} meals sold</p>
              </Card>
            ) : (
              <Card className="p-4 space-y-4">
                <p className="text-sm font-medium text-slate-700">Post-Event Report</p>
                <Textarea
                  label="How did the event go? *"
                  value={reportForm.feedback}
                  onChange={(e) => setReportForm({ ...reportForm, feedback: e.target.value })}
                  rows={3}
                />
                <Textarea
                  label="Issues encountered"
                  value={reportForm.issues}
                  onChange={(e) => setReportForm({ ...reportForm, issues: e.target.value })}
                  rows={2}
                />
                <Input
                  label="Total Meals Sold"
                  type="number"
                  min="0"
                  value={reportForm.mealsSold}
                  onChange={(e) => setReportForm({ ...reportForm, mealsSold: e.target.value })}
                  placeholder="0"
                />

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-slate-700">Sales & Commission</p>
                    <span className="text-xs text-slate-400">{sales.length} sale{sales.length !== 1 ? 's' : ''}{editAvgMeals ? ` · ${editAvgMeals} meals/sale` : ''}</span>
                  </div>
                  {sales.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {sales.map((sale, i) => (
                        <div key={sale.id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2.5">
                          <span className="text-xs font-medium text-slate-500 w-12 shrink-0">Sale {i + 1}</span>
                          <label className="flex items-center gap-2 flex-1 cursor-pointer">
                            <input type="checkbox" checked={sale.overThreshold} onChange={() => toggleSale(sale.id)} className="accent-mint-600" />
                            <span className="text-sm text-slate-700">$99 or more</span>
                          </label>
                          <span className={`text-sm font-semibold ${sale.overThreshold ? 'text-mint-600' : 'text-slate-500'}`}>
                            {formatCurrency(sale.overThreshold ? COMMISSION_OVER : COMMISSION_UNDER)}
                          </span>
                          <button type="button" onClick={() => removeSale(sale.id)} className="text-slate-300 hover:text-red-500 shrink-0">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button type="button" variant="secondary" size="sm" onClick={addSale} className="w-full">
                    <Plus size={14} /> Add Sale
                  </Button>
                  {sales.length > 0 && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                      <span className="text-sm text-slate-600">Estimated commission</span>
                      <span className="text-lg font-bold text-mint-600">{formatCurrency(editEstimatedCommission)}</span>
                    </div>
                  )}
                </div>

                {reportError && <div className="text-sm text-red-600">{reportError}</div>}
                <Button onClick={handleSaveReport} disabled={savingReport} className="w-full">
                  {savingReport ? 'Saving...' : 'Save Report'}
                </Button>
              </Card>
            )}

            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setEditShiftId(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
