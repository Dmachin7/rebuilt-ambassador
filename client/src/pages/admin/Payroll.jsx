import React, { useEffect, useState } from 'react';
import { paymentsAPI } from '../../api/index.js';
import { Card, Button, Badge, Select, Spinner, EmptyState } from '../../components/ui/index.jsx';
import { formatCurrency, formatHours, formatDate } from '../../utils/formatters.js';
import { Download, Calendar } from 'lucide-react';

const STATUS_OPTIONS = ['PENDING', 'APPROVED', 'PAID'];

// Bi-weekly summary tab
function BiweeklySummary() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Default date range: last 14 days
  const defaultEnd = new Date();
  const defaultStart = new Date(defaultEnd.getTime() - 14 * 24 * 3600000);
  const toDateInput = (d) => d.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(toDateInput(defaultStart));
  const [endDate, setEndDate] = useState(toDateInput(defaultEnd));

  const load = () => {
    setLoading(true);
    paymentsAPI.biweekly(startDate, endDate)
      .then(setSummary)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const exportCsv = () => {
    if (!summary) return;
    const headers = [
      'First Name', 'Last Name', 'Email', 'Shifts', 'Hours Worked',
      'Hourly Pay', 'Miles Driven', 'Mileage Reimbursement',
      'Sales This Period', 'Commission Earned', 'Total Payout', 'Lifetime Sales',
    ];
    const rows = summary.summary.map((r) => [
      r.firstName, r.lastName, r.email, r.shiftCount,
      r.hoursWorked.toFixed(2), `$${r.hourlyPay.toFixed(2)}`,
      r.milesDriven.toFixed(1), `$${r.mileageReimbursement.toFixed(2)}`,
      r.salesThisPeriod, `$${r.commissionEarned.toFixed(2)}`,
      `$${r.totalPayout.toFixed(2)}`, r.lifetimeSalesCount,
    ]);
    const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rebuilt-biweekly-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Date range picker */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Period Start</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="input-field text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Period End</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="input-field text-sm" />
          </div>
          <Button onClick={load} size="sm">Apply</Button>
          <Button onClick={exportCsv} variant="secondary" size="sm" disabled={!summary}>
            <Download size={14} /> Export CSV
          </Button>
        </div>
        {summary && (
          <p className="text-xs text-slate-400 mt-2">
            Period: {new Date(summary.start).toLocaleDateString()} – {new Date(summary.end).toLocaleDateString()}
          </p>
        )}
      </Card>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner className="w-6 h-6" /></div>
      ) : !summary || summary.summary.length === 0 ? (
        <Card className="p-8">
          <EmptyState icon="📊" title="No data for this period" description="No completed shifts found in the selected date range" />
        </Card>
      ) : (
        <>
          {/* Period totals */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-4 text-center">
              <div className="text-xl font-bold text-slate-800">
                {formatCurrency(summary.summary.reduce((s, r) => s + r.hourlyPay, 0))}
              </div>
              <div className="text-xs text-slate-500 mt-1">Hourly Pay</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-xl font-bold text-slate-800">
                {formatCurrency(summary.summary.reduce((s, r) => s + r.mileageReimbursement, 0))}
              </div>
              <div className="text-xs text-slate-500 mt-1">Mileage</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-xl font-bold text-mint-600">
                {formatCurrency(summary.summary.reduce((s, r) => s + r.commissionEarned, 0))}
              </div>
              <div className="text-xs text-slate-500 mt-1">Commission</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-xl font-bold text-slate-800">
                {formatCurrency(summary.summary.reduce((s, r) => s + r.totalPayout, 0))}
              </div>
              <div className="text-xs text-slate-500 mt-1">Total Payout</div>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Ambassador</th>
                    <th className="px-4 py-3 text-right">Shifts</th>
                    <th className="px-4 py-3 text-right">Hours</th>
                    <th className="px-4 py-3 text-right">Hourly Pay</th>
                    <th className="px-4 py-3 text-right">Miles</th>
                    <th className="px-4 py-3 text-right">Mileage</th>
                    <th className="px-4 py-3 text-right">Sales</th>
                    <th className="px-4 py-3 text-right">Commission</th>
                    <th className="px-4 py-3 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {summary.summary.map((r) => (
                    <tr key={r.ambassadorId} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-700">{r.firstName} {r.lastName}</div>
                        <div className="text-xs text-slate-400">{r.lifetimeSalesCount} lifetime sales</div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.shiftCount}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatHours(r.hoursWorked)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(r.hourlyPay)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.milesDriven.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(r.mileageReimbursement)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{r.salesThisPeriod}</td>
                      <td className="px-4 py-3 text-right text-mint-700 font-medium">{formatCurrency(r.commissionEarned)}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(r.totalPayout)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="text-xs text-slate-400">
            Commission: $10/sale for first 50 lifetime sales · $20/sale thereafter · Mileage: $0.30/mile (round-trip)
          </p>
        </>
      )}
    </div>
  );
}

// Standard payroll tab
function PayrollRecords() {
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = () => paymentsAPI.list(filter || undefined).then(setPayments).finally(() => setLoading(false));
  useEffect(() => { setLoading(true); load(); }, [filter]);

  const handleStatus = async (id, newStatus) => {
    setUpdating(id);
    try {
      await paymentsAPI.updateStatus(id, newStatus);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdating(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await paymentsAPI.exportCsv();
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const totalPending = payments.filter((p) => p.status === 'PENDING').reduce((s, p) => s + p.amount, 0);
  const totalApproved = payments.filter((p) => p.status === 'APPROVED').reduce((s, p) => s + p.amount, 0);
  const totalPaid = payments.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{payments.length} payment records</p>
        <Button onClick={handleExport} disabled={exporting} variant="secondary">
          <Download size={16} /> {exporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <div className="text-xl font-bold text-orange-600">{formatCurrency(totalPending)}</div>
          <div className="text-xs text-slate-500 mt-1">Pending</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-xl font-bold text-blue-600">{formatCurrency(totalApproved)}</div>
          <div className="text-xs text-slate-500 mt-1">Approved</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
          <div className="text-xs text-slate-500 mt-1">Paid Out</div>
        </Card>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {[['', 'All'], ['PENDING', 'Pending'], ['APPROVED', 'Approved'], ['PAID', 'Paid']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === val ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {payments.length === 0 ? (
        <Card className="p-8"><EmptyState icon="💰" title="No payments yet" description="Payments are created automatically when ambassadors check out" /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Ambassador</th>
                  <th className="px-4 py-3 text-left">Event</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right">Hours</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-700">{p.ambassador.firstName} {p.ambassador.lastName}</div>
                      <div className="text-xs text-slate-400">{p.ambassador.email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{p.shift.event.title}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{formatDate(p.shift.event.date)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatHours(p.hoursWorked)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3 text-center"><Badge status={p.status} /></td>
                    <td className="px-4 py-3 text-center">
                      <select
                        value={p.status}
                        onChange={(e) => handleStatus(p.id, e.target.value)}
                        disabled={updating === p.id}
                        className="text-xs border border-slate-200 rounded px-1.5 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-mint-300"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <p className="text-xs text-slate-400">
        * Export includes full 1099 fields + commission + mileage. Encrypt SSN before storing in production.
      </p>
    </div>
  );
}

export default function AdminPayroll() {
  const [tab, setTab] = useState('records');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Payroll</h1>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('records')}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'records' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
          Payment Records
        </button>
        <button onClick={() => setTab('biweekly')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'biweekly' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
          <Calendar size={12} /> Bi-Weekly Summary
        </button>
      </div>

      {tab === 'records' ? <PayrollRecords /> : <BiweeklySummary />}
    </div>
  );
}
