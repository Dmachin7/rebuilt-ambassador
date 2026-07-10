import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { shiftsAPI, reportsAPI } from '../../api/index.js';
import { Card, Button, Input, Textarea, Spinner } from '../../components/ui/index.jsx';
import { formatShortDate, formatCurrency } from '../../utils/formatters.js';
import { CheckCircle, Plus, Trash2 } from 'lucide-react';

const COMMISSION_UNDER = 20;
const COMMISSION_OVER = 40;
let nextSaleId = 0;

export default function ReportForm() {
  const { shiftId } = useParams();
  const navigate = useNavigate();
  const [myShifts, setMyShifts] = useState([]);
  const [selectedShiftId, setSelectedShiftId] = useState(shiftId || '');
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    feedback: '',
    issues: '',
    mealsSold: '',
  });
  const [sales, setSales] = useState([]);

  const avgMeals =
    form.mealsSold && sales.length > 0
      ? (parseInt(form.mealsSold) / sales.length).toFixed(1)
      : null;

  const estimatedCommission = sales.reduce((s, sale) => s + (sale.overThreshold ? COMMISSION_OVER : COMMISSION_UNDER), 0);

  const addSale = () => setSales((prev) => [...prev, { id: nextSaleId++, overThreshold: false }]);
  const removeSale = (id) => setSales((prev) => prev.filter((s) => s.id !== id));
  const toggleSale = (id) => setSales((prev) => prev.map((s) => (s.id === id ? { ...s, overThreshold: !s.overThreshold } : s)));

  useEffect(() => {
    shiftsAPI.list().then((shifts) => {
      const completedNoReport = shifts.filter((s) => s.status === 'COMPLETED' && !s.report);
      setMyShifts(completedNoReport);
      if (!shiftId && completedNoReport.length > 0) {
        setSelectedShiftId(completedNoReport[0].id);
      }
      setLoading(false);
    });
  }, []);

  const f = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.feedback.trim()) { setError('Feedback is required'); return; }
    if (!selectedShiftId) { setError('Please select a shift'); return; }
    setSaving(true);
    setError('');
    try {
      await reportsAPI.create({
        shiftId: selectedShiftId,
        feedback: form.feedback,
        issues: form.issues || undefined,
        mealsSold: form.mealsSold || 0,
        sales: sales.map((s) => ({ overThreshold: s.overThreshold })),
      });
      setSubmitted(true);
      setTimeout(() => navigate('/shifts'), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20">
        <CheckCircle size={64} className="text-mint-400 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">Report submitted!</h2>
        <p className="text-sm text-slate-500">Great work — redirecting to your shifts.</p>
      </div>
    );
  }

  const completedShifts = myShifts;
  const selectedShift = completedShifts.find((s) => s.id === selectedShiftId);

  if (completedShifts.length === 0) {
    return (
      <div className="px-4 py-8 max-w-lg mx-auto">
        <Card className="p-8 text-center">
          <p className="text-slate-500 mb-2">No shifts waiting for a report.</p>
          <p className="text-xs text-slate-400 mb-4">Reports can only be submitted after checking out.</p>
          <Button onClick={() => navigate('/shifts')} variant="secondary" size="sm">Back to Shifts</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 max-w-lg mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-800">Post-Event Report</h1>
        <p className="text-sm text-slate-500 mt-0.5">Tell us how the event went</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {completedShifts.length > 1 && (
          <Card className="p-4">
            <label className="label">Select Shift</label>
            <select
              value={selectedShiftId}
              onChange={(e) => setSelectedShiftId(e.target.value)}
              className="input-field"
            >
              {completedShifts.map((s) => (
                <option key={s.id} value={s.id}>{s.event.title} — {formatShortDate(s.event.date)}</option>
              ))}
            </select>
          </Card>
        )}

        {selectedShift && (
          <Card className="p-3 bg-mint-50 border-mint-200">
            <p className="text-sm font-medium text-mint-700">{selectedShift.event.title}</p>
            <p className="text-xs text-slate-500">{formatShortDate(selectedShift.event.date)}</p>
            {(selectedShift.event.milesFromHq != null || selectedShift.event.driveTimeMins != null) && (
              <p className="text-xs text-slate-500 mt-1">
                Round-trip: {(selectedShift.event.milesFromHq || 0).toFixed(1)} mi
                {selectedShift.event.driveTimeMins != null && `, ${selectedShift.event.driveTimeMins} min drive`}
                {selectedShift.event.setupTimeMins ? ` + ${selectedShift.event.setupTimeMins} min setup` : ''} — included in your pay
              </p>
            )}
          </Card>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>
        )}

        <Card className="p-4 space-y-4">
          <Textarea
            label="How did the event go? *"
            value={form.feedback}
            onChange={f('feedback')}
            rows={4}
            placeholder="Tell us about customer reactions, what worked well, any highlights..."
            required
          />
          <Textarea
            label="Issues encountered"
            value={form.issues}
            onChange={f('issues')}
            rows={3}
            placeholder="Any problems with setup, samples, equipment, or customers? (Optional)"
          />
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-sm font-medium text-slate-700">📊 Sales Numbers</p>
            <div className="text-center">
              <div className={`text-lg font-bold ${avgMeals ? 'text-mint-600' : 'text-slate-300'}`}>
                {avgMeals || '—'}
              </div>
              <div className="text-xs text-slate-400">Avg meals/sale</div>
            </div>
          </div>
          <Input
            label="Total Meals Sold"
            type="number"
            min="0"
            value={form.mealsSold}
            onChange={f('mealsSold')}
            placeholder="0"
          />
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-700">💵 Sales & Commission</p>
            <span className="text-xs text-slate-400">{sales.length} sale{sales.length !== 1 ? 's' : ''}</span>
          </div>

          {sales.length === 0 ? (
            <p className="text-xs text-slate-400 italic mb-3">No sales added yet. Tap "Add Sale" for each transaction.</p>
          ) : (
            <div className="space-y-2 mb-3">
              {sales.map((sale, i) => (
                <div key={sale.id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2.5">
                  <span className="text-xs font-medium text-slate-500 w-12 shrink-0">Sale {i + 1}</span>
                  <label className="flex items-center gap-2 flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sale.overThreshold}
                      onChange={() => toggleSale(sale.id)}
                      className="accent-mint-600"
                    />
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
              <span className="text-lg font-bold text-mint-600">{formatCurrency(estimatedCommission)}</span>
            </div>
          )}
          <p className="text-xs text-slate-400 mt-2">
            Leave "$99 or more" checked only if that sale's total was $99+. Admin will verify each sale against Shopify — commission isn't final until then.
          </p>
        </Card>

        <Button type="submit" className="w-full py-3 text-base" disabled={saving}>
          {saving ? 'Submitting...' : 'Submit Report'}
        </Button>
      </form>
    </div>
  );
}
