import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { shiftsAPI, reportsAPI } from '../../api/index.js';
import { Card, Button, Input, Textarea, Spinner } from '../../components/ui/index.jsx';
import { formatShortDate } from '../../utils/formatters.js';
import { CheckCircle } from 'lucide-react';

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
    totalSales: '',
  });

  const avgMeals =
    form.mealsSold && form.totalSales && parseInt(form.totalSales) > 0
      ? (parseInt(form.mealsSold) / parseInt(form.totalSales)).toFixed(1)
      : null;

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
        totalSales: form.totalSales || 0,
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
          <p className="text-sm font-medium text-slate-700 mb-3">📊 Sales Numbers</p>
          <div className="grid grid-cols-3 gap-3 items-end">
            <Input
              label="Total Meals Sold"
              type="number"
              min="0"
              value={form.mealsSold}
              onChange={f('mealsSold')}
              placeholder="0"
            />
            <Input
              label="Total Sales"
              type="number"
              min="0"
              value={form.totalSales}
              onChange={f('totalSales')}
              placeholder="0"
            />
            <div className="text-center pb-1">
              <div className={`text-lg font-bold ${avgMeals ? 'text-mint-600' : 'text-slate-300'}`}>
                {avgMeals || '—'}
              </div>
              <div className="text-xs text-slate-400">Avg meals/sale</div>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Avg meals/sale is auto-calculated · affects your leaderboard score (7+ avg = bonus points)
          </p>
        </Card>

        <Button type="submit" className="w-full py-3 text-base" disabled={saving}>
          {saving ? 'Submitting...' : 'Submit Report'}
        </Button>
      </form>
    </div>
  );
}
