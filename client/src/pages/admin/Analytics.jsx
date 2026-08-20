import React, { useEffect, useState } from 'react';
import { analyticsAPI } from '../../api/index.js';
import { Card, Spinner, EmptyState, Button } from '../../components/ui/index.jsx';
import DateRangeControl, { startOfWeekMonday, addDays, toInputValue } from '../../components/DateRangeControl.jsx';
import { formatCurrency, formatHours } from '../../utils/formatters.js';
import { Download } from 'lucide-react';

const longDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function downloadCsvBlob(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function CacTab({ range }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    analyticsAPI
      .cac(toInputValue(range.start), toInputValue(range.end))
      .then(setData)
      .finally(() => setLoading(false));
  }, [range.start, range.end]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;

  const cumulative = data?.cumulative;
  // Ambassadors with no completed shifts in this range are omitted from the table — the
  // backend returns everyone (zeroed out) so the cumulative totals stay a full-roster sum.
  const rows = (data?.perAmbassador || []).filter((a) => a.shiftCount > 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-slate-800">{cumulative?.salesCount ?? 0}</div>
          <div className="text-xs text-slate-500 mt-1">Total Sales</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-slate-800">{formatCurrency(cumulative?.totalCost)}</div>
          <div className="text-xs text-slate-500 mt-1">Total Cost</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-mint-600">
            {cumulative?.cac != null ? formatCurrency(cumulative.cac) : '—'}
          </div>
          <div className="text-xs text-slate-500 mt-1">Cost per Sale (CAC)</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-slate-800">
            {cumulative?.avgHoursPerSale != null ? formatHours(cumulative.avgHoursPerSale) : '—'}
          </div>
          <div className="text-xs text-slate-500 mt-1">Avg Hours / Sale</div>
        </Card>
      </div>

      <p className="text-xs text-slate-400">
        Cost = hourly pay + mileage reimbursement + verified commission, for shifts checked out within this range.
      </p>

      {rows.length === 0 ? (
        <Card className="p-8">
          <EmptyState icon="📊" title="No completed shifts in this range" description="Try a different date range" />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2.5">Ambassador</th>
                <th className="text-right px-4 py-2.5">Shifts</th>
                <th className="text-right px-4 py-2.5">Hours</th>
                <th className="text-right px-4 py-2.5">Sales</th>
                <th className="text-right px-4 py-2.5">Total Cost</th>
                <th className="text-right px-4 py-2.5">CAC</th>
                <th className="text-right px-4 py-2.5">Hours/Sale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((a) => (
                <tr key={a.ambassadorId}>
                  <td className="px-4 py-3 font-medium text-slate-700">{a.firstName} {a.lastName}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{a.shiftCount}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{formatHours(a.hoursWorked)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{a.salesCount}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(a.totalCost)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${a.cac == null ? 'text-slate-300' : 'text-slate-800'}`}>
                    {a.cac != null ? formatCurrency(a.cac) : 'No sales'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {a.avgHoursPerSale != null ? formatHours(a.avgHoursPerSale) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function PromoLogTab({ range }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    analyticsAPI
      .promoLog(toInputValue(range.start), toInputValue(range.end))
      .then(setData)
      .finally(() => setLoading(false));
  }, [range.start, range.end]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;

  const rows = data?.rows || [];
  const totals = data?.totals;

  const exportCsv = () => {
    const header = ['Date', 'Promo / Location', 'Ambassador', 'Hours Worked', 'Sales', 'Total Meals Sold', 'Avg Meals/Sale', 'Source'];
    const lines = rows.map((r) => [
      toInputValue(r.date),
      r.promoName,
      r.ambassadorName,
      r.hoursWorked ?? '',
      r.salesCount,
      r.mealsSold,
      r.avgMealsPerSale ?? '',
      r.source === 'imported' ? 'Imported' : 'Live',
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    downloadCsvBlob(`rebuilt-promo-log-${toInputValue(new Date())}.csv`, csv);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="grid grid-cols-3 gap-3 flex-1 min-w-[280px]">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-slate-800">{totals ? formatHours(totals.hoursWorked) : '—'}</div>
            <div className="text-xs text-slate-500 mt-1">Total Hours</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-slate-800">{totals?.salesCount ?? 0}</div>
            <div className="text-xs text-slate-500 mt-1">Total Sales</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-slate-800">{totals?.mealsSold ?? 0}</div>
            <div className="text-xs text-slate-500 mt-1">Total Meals Sold</div>
          </Card>
        </div>
        <Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="w-4 h-4 mr-1.5" /> Export CSV
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card className="p-8">
          <EmptyState icon="📋" title="No promos in this range" description="Try a different date range" />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2.5">Date</th>
                <th className="text-left px-4 py-2.5">Promo / Location</th>
                <th className="text-left px-4 py-2.5">Ambassador</th>
                <th className="text-right px-4 py-2.5">Hours</th>
                <th className="text-right px-4 py-2.5">Sales</th>
                <th className="text-right px-4 py-2.5">Meals Sold</th>
                <th className="text-right px-4 py-2.5">Avg Meals/Sale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((r) => (
                <tr key={r.shiftId}>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{longDate(r.date)}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {r.promoName}
                    {r.source === 'imported' && (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">
                        Imported
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.ambassadorName}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{r.hoursWorked != null ? formatHours(r.hoursWorked) : '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{r.salesCount}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{r.mealsSold}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{r.avgMealsPerSale ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

const TABS = [
  { key: 'cac', label: 'Cost per Sale' },
  { key: 'promoLog', label: 'Promo Log' },
];

export default function AdminAnalytics() {
  const [tab, setTab] = useState('cac');
  const [range, setRange] = useState(() => {
    const start = startOfWeekMonday(new Date());
    return { start, end: addDays(start, 6) };
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Analytics</h1>
          <p className="text-sm text-slate-500">Customer acquisition cost and sales efficiency, per ambassador and cumulative.</p>
        </div>
        <DateRangeControl range={range} onChange={setRange} />
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-mint-600 text-mint-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'cac' ? <CacTab range={range} /> : <PromoLogTab range={range} />}
    </div>
  );
}
