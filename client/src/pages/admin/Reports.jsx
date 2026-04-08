import React, { useEffect, useState } from 'react';
import { eventsAPI, reportsAPI } from '../../api/index.js';
import { Card, Select, Spinner, EmptyState } from '../../components/ui/index.jsx';
import { formatDate, formatDateTime } from '../../utils/formatters.js';

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([reportsAPI.list(filter || undefined), eventsAPI.list()])
      .then(([r, e]) => { setReports(r); setEvents(e); })
      .finally(() => setLoading(false));
  }, [filter]);

  const totalMealsSold = reports.reduce((s, r) => s + (r.mealsSold || 0), 0);
  const totalSalesCount = reports.reduce((s, r) => s + (r.totalSales || 0), 0);
  const avgMeals =
    reports.filter((r) => r.mealsPerSale).reduce((s, r) => s + r.mealsPerSale, 0) /
    (reports.filter((r) => r.mealsPerSale).length || 1);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Post-Event Reports</h1>
        <p className="text-sm text-slate-500">{reports.length} reports submitted</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
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
