import React, { useEffect, useState } from 'react';
import { eventsAPI, reportsAPI } from '../../api/index.js';
import { Card, Select, Spinner, EmptyState, Button } from '../../components/ui/index.jsx';
import { formatDate, formatDateTime, formatCurrency } from '../../utils/formatters.js';
import { CheckCircle2 } from 'lucide-react';

const MILEAGE_RATE = 0.30; // matches server/src/config/constants.js

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({}); // saleId -> overThreshold override before confirming
  const [verifyingId, setVerifyingId] = useState(null);

  const load = () =>
    Promise.all([reportsAPI.list(filter || undefined), eventsAPI.list()])
      .then(([r, e]) => { setReports(r); setEvents(e); });

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [filter]);

  const handleVerify = async (reportId, sale) => {
    const overThreshold = drafts[sale.id] ?? sale.overThreshold;
    setVerifyingId(sale.id);
    try {
      await reportsAPI.verifySale(reportId, sale.id, overThreshold);
      await load();
    } catch (err) {
      alert('Failed to verify sale: ' + err.message);
    } finally {
      setVerifyingId(null);
    }
  };

  const allSales = reports.flatMap((r) => r.sales || []);
  const totalMealsSold = reports.reduce((s, r) => s + (r.mealsSold || 0), 0);
  const totalSalesCount = reports.reduce((s, r) => s + (r.totalSales || 0), 0);
  const avgMeals =
    reports.filter((r) => r.mealsPerSale).reduce((s, r) => s + r.mealsPerSale, 0) /
    (reports.filter((r) => r.mealsPerSale).length || 1);
  const pendingCount = allSales.filter((s) => !s.verified).length;
  const verifiedCommission = allSales.filter((s) => s.verified).reduce((s, sale) => s + sale.commission, 0);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Post-Event Reports</h1>
        <p className="text-sm text-slate-500">{reports.length} reports submitted</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-slate-800">{totalMealsSold}</div>
          <div className="text-xs text-slate-500 mt-1">Total Meals Sold</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-slate-800">{totalSalesCount}</div>
          <div className="text-xs text-slate-500 mt-1">Total Sales</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-mint-600">{avgMeals.toFixed(1)}</div>
          <div className="text-xs text-slate-500 mt-1">Avg Meals/Sale</div>
        </Card>
        <Card className={`p-4 text-center ${pendingCount > 0 ? 'border-orange-200 bg-orange-50' : ''}`}>
          <div className={`text-2xl font-bold ${pendingCount > 0 ? 'text-orange-600' : 'text-slate-800'}`}>{pendingCount}</div>
          <div className="text-xs text-slate-500 mt-1">Sales Pending Verification</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-mint-600">{formatCurrency(verifiedCommission)}</div>
          <div className="text-xs text-slate-500 mt-1">Verified Commission</div>
        </Card>
      </div>

      {/* Filter */}
      <div className="max-w-xs">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All Events</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </Select>
      </div>

      {reports.length === 0 ? (
        <Card className="p-8"><EmptyState icon="📝" title="No reports yet" description="Reports appear here once ambassadors submit them after events" /></Card>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <Card key={report.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <div className="font-semibold text-slate-800">{report.shift.event.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {report.shift.ambassador?.firstName} {report.shift.ambassador?.lastName} · {formatDate(report.shift.event.date)}
                  </div>
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-bold text-slate-800">{report.mealsSold}</div>
                    <div className="text-xs text-slate-400">Meals Sold</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-slate-800">{report.totalSales}</div>
                    <div className="text-xs text-slate-400">Total Sales</div>
                  </div>
                  {report.mealsPerSale && (
                    <div className="text-center">
                      <div className="font-bold text-mint-600">{report.mealsPerSale.toFixed(1)}</div>
                      <div className="text-xs text-slate-400">Meals/Sale</div>
                    </div>
                  )}
                </div>
              </div>
              {(report.shift.event.milesFromHq != null || report.shift.event.driveTimeMins != null) && (
                <div className="bg-slate-50 rounded-lg px-3 py-2 mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500">
                    Round-trip: {((report.shift.event.milesFromHq || 0) * 2).toFixed(1)} mi
                    {report.shift.event.driveTimeMins != null && `, ${report.shift.event.driveTimeMins * 2} min drive`}
                    {report.shift.event.setupTimeMins ? ` + ${report.shift.event.setupTimeMins} min setup` : ''}
                  </span>
                  <span className="font-semibold text-slate-700">
                    Mileage reimbursement: {formatCurrency((report.shift.event.milesFromHq || 0) * 2 * MILEAGE_RATE)}
                  </span>
                </div>
              )}
              {report.sales?.length > 0 && (
                <div className="border border-slate-100 rounded-lg overflow-hidden mb-3">
                  <div className="bg-slate-50 px-3 py-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-slate-500">Sales Verification</p>
                    <p className="text-xs text-slate-400">
                      {report.sales.filter((s) => s.verified).length}/{report.sales.length} verified
                    </p>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {report.sales.map((sale, i) => {
                      const draftValue = drafts[sale.id] ?? sale.overThreshold;
                      return (
                        <div key={sale.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                          <span className="text-xs text-slate-400 w-12 shrink-0">Sale {i + 1}</span>
                          {sale.verified ? (
                            <>
                              <span className="flex items-center gap-1 text-green-600 flex-1">
                                <CheckCircle2 size={14} /> Verified · {sale.overThreshold ? '$99+' : 'Under $99'}
                              </span>
                              <span className="font-semibold text-slate-700">{formatCurrency(sale.commission)}</span>
                            </>
                          ) : (
                            <>
                              <label className="flex items-center gap-2 flex-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={draftValue}
                                  onChange={(e) => setDrafts((prev) => ({ ...prev, [sale.id]: e.target.checked }))}
                                  className="accent-mint-600"
                                />
                                <span className="text-slate-700">$99 or more</span>
                                <span className="text-xs text-slate-400">(ambassador said {sale.overThreshold ? '$99+' : 'under $99'})</span>
                              </label>
                              <span className="font-semibold text-orange-600">{formatCurrency(draftValue ? 40 : 20)}</span>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleVerify(report.id, sale)}
                                disabled={verifyingId === sale.id}
                              >
                                {verifyingId === sale.id ? '...' : 'Confirm'}
                              </Button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="bg-slate-50 rounded-lg p-3 mb-2">
                <p className="text-xs font-medium text-slate-500 mb-1">Feedback</p>
                <p className="text-sm text-slate-700">{report.feedback}</p>
              </div>
              {report.issues && (
                <div className="bg-orange-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-orange-600 mb-1">⚠️ Issues</p>
                  <p className="text-sm text-slate-700">{report.issues}</p>
                </div>
              )}
              <p className="text-xs text-slate-400 mt-2">Submitted {formatDateTime(report.submittedAt)}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
