import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventsAPI, exportsAPI } from '../../api/index.js';
import { Card, Button, Select, Spinner, EmptyState } from '../../components/ui/index.jsx';
import { computeBags } from '../../utils/bagTags.js';
import { MapPin, Download, Printer, AlertTriangle } from 'lucide-react';

const startOfWeekMonday = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
};
const addDays = (date, n) => new Date(date.getTime() + n * 86400000);
const shortDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const longDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatWeekRange = (start, end) => `${shortDate(start)} – ${longDate(end)}`;

// Local (not UTC) YYYY-MM-DD so a date input round-trips to the same calendar day
// regardless of timezone offset.
const toInputValue = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const fromInputValue = (v) => {
  const [y, m, d] = v.split('-').map(Number);
  return new Date(y, m - 1, d);
};

function DateRangeControl({ range, onChange }) {
  const rangeDays = Math.round((range.end - range.start) / 86400000) + 1;
  const shiftRange = (days) => onChange({ start: addDays(range.start, days), end: addDays(range.end, days) });
  const resetToThisWeek = () => {
    const start = startOfWeekMonday(new Date());
    onChange({ start, end: addDays(start, 6) });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button variant="secondary" size="sm" onClick={() => shiftRange(-rangeDays)}>‹</Button>
      <input
        type="date"
        value={toInputValue(range.start)}
        onChange={(e) => onChange({ ...range, start: fromInputValue(e.target.value) })}
        className="input-field !w-auto text-sm py-1.5"
      />
      <span className="text-slate-400 text-sm">to</span>
      <input
        type="date"
        value={toInputValue(range.end)}
        onChange={(e) => onChange({ ...range, end: fromInputValue(e.target.value) })}
        className="input-field !w-auto text-sm py-1.5"
      />
      <Button variant="secondary" size="sm" onClick={() => shiftRange(rangeDays)}>›</Button>
      <Button variant="secondary" size="sm" onClick={resetToThisWeek}>This Week</Button>
    </div>
  );
}

function ProjectionsTab({ range }) {
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setLoading(true);
    exportsAPI
      .projections(toInputValue(range.start), toInputValue(range.end))
      .then(setWeeks)
      .finally(() => setLoading(false));
  }, [range.start, range.end]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await exportsAPI.projectionsCsv(toInputValue(range.start), toInputValue(range.end));
    } catch (err) {
      alert('Failed to download CSV: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Total meals and snack bites needed, grouped by week (Mon–Sun), within the selected date range.</p>
        <Button onClick={handleDownload} disabled={downloading} className="shrink-0 flex items-center gap-1.5">
          <Download size={14} /> {downloading ? 'Downloading...' : 'Download CSV'}
        </Button>
      </div>

      {weeks.length === 0 ? (
        <Card className="p-8"><EmptyState icon="📦" title="No meals/snack bites needed" description="Weeks appear here once events in this range have sample meals or snack bites set" /></Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2.5">Week</th>
                <th className="text-right px-4 py-2.5">Meals</th>
                <th className="text-right px-4 py-2.5">Snack Bites</th>
                <th className="text-right px-4 py-2.5">Events</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {weeks.map((w) => (
                <tr key={w.weekStart}>
                  <td className="px-4 py-3 font-medium text-slate-700">{formatWeekRange(w.weekStart, w.weekEnd)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{w.totalMeals}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{w.totalSnackBites}</td>
                  <td className="px-4 py-3 text-right text-slate-400">{w.eventCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function BagTagsTab({ range }) {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState({}); // eventId -> boolean

  useEffect(() => {
    eventsAPI.list().then(setEvents).finally(() => setLoading(false));
  }, []);

  const rangeEvents = events.filter((e) => {
    const d = new Date(e.date);
    return d >= range.start && d < addDays(range.end, 1) && ((e.samplesNeeded || 0) > 0 || (e.snackBitesNeeded || 0) > 0);
  });

  // Default-select events that have a deliver-to location; leave ones missing it unchecked.
  useEffect(() => {
    setSelected((prev) => {
      const next = { ...prev };
      rangeEvents.forEach((e) => {
        if (!(e.id in next)) next[e.id] = !!e.pickupLocation;
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end, events.length]);

  const toggle = (id) => setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  const handlePrint = () => {
    const chosen = rangeEvents.filter((e) => selected[e.id]);
    const tags = chosen.flatMap((e) => {
      const bags = computeBags(e.samplesNeeded, e.snackBitesNeeded);
      return bags.map((bag, i) => ({
        title: e.title,
        pickupLocation: e.pickupLocation || '',
        date: e.date,
        bagIndex: i + 1,
        bagCount: bags.length,
        meals: bag.meals,
        snackBites: bag.snackBites,
      }));
    });
    if (tags.length === 0) {
      alert('Select at least one event to print bag tags for.');
      return;
    }
    navigate('/admin/exports/bag-tags/print', { state: { tags } });
  };

  const selectedCount = rangeEvents.filter((e) => selected[e.id]).length;

  if (loading) return <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-3">
        <Button onClick={handlePrint} disabled={selectedCount === 0} className="flex items-center gap-1.5">
          <Printer size={14} /> Print Tags ({selectedCount})
        </Button>
      </div>

      {rangeEvents.length === 0 ? (
        <Card className="p-8"><EmptyState icon="🏷️" title="No events need bag tags in this range" description="Events show up here once they have sample meals or snack bites set" /></Card>
      ) : (
        <Card className="divide-y divide-slate-50">
          {rangeEvents.map((e) => {
            const bags = computeBags(e.samplesNeeded, e.snackBitesNeeded);
            return (
              <label key={e.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={!!selected[e.id]}
                  onChange={() => toggle(e.id)}
                  className="accent-mint-600 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700 truncate">{e.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{longDate(e.date)}</div>
                  {e.pickupLocation ? (
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin size={11} className="text-slate-400" /> {e.pickupLocation}
                    </div>
                  ) : (
                    <div className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                      <AlertTriangle size={11} /> No deliver-to location set
                    </div>
                  )}
                </div>
                <div className="text-xs text-slate-500 text-right shrink-0">
                  {e.samplesNeeded ? <div>{e.samplesNeeded} meals</div> : null}
                  {e.snackBitesNeeded ? <div>{e.snackBitesNeeded} snacks</div> : null}
                  <div className="font-semibold text-slate-700 mt-0.5">{bags.length} bag{bags.length !== 1 ? 's' : ''}</div>
                </div>
              </label>
            );
          })}
        </Card>
      )}
    </div>
  );
}

export default function AdminExports() {
  const [type, setType] = useState('bagTags');
  const [range, setRange] = useState(() => {
    const start = startOfWeekMonday(new Date());
    return { start, end: addDays(start, 6) };
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Exports</h1>
        <p className="text-sm text-slate-500">Weekly projections and printable bag tags.</p>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Select value={type} onChange={(e) => setType(e.target.value)} className="!w-44">
          <option value="bagTags">Bag Tags</option>
          <option value="projections">Projections</option>
        </Select>
        <DateRangeControl range={range} onChange={setRange} />
      </div>

      {type === 'projections' ? <ProjectionsTab range={range} /> : <BagTagsTab range={range} />}
    </div>
  );
}
