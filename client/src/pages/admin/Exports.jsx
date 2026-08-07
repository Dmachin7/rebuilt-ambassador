import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventsAPI } from '../../api/index.js';
import { Card, Button, Select, Spinner, EmptyState } from '../../components/ui/index.jsx';
import DateRangeControl, { startOfWeekMonday, addDays, toInputValue } from '../../components/DateRangeControl.jsx';
import { computeBags } from '../../utils/bagTags.js';
import { MapPin, Download, Printer, AlertTriangle } from 'lucide-react';

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

function ProjectionsTab({ range }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState({}); // eventId -> boolean

  useEffect(() => {
    eventsAPI.list().then(setEvents).finally(() => setLoading(false));
  }, []);

  const rangeEvents = events.filter((e) => {
    const d = new Date(e.date);
    return d >= range.start && d < addDays(range.end, 1) && ((e.samplesNeeded || 0) > 0 || (e.breakfastsNeeded || 0) > 0 || (e.snackBitesNeeded || 0) > 0);
  });

  // Everything in range starts selected — admin unclicks anything that shouldn't count.
  useEffect(() => {
    setSelected((prev) => {
      const next = { ...prev };
      rangeEvents.forEach((e) => {
        if (!(e.id in next)) next[e.id] = true;
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end, events.length]);

  const toggle = (id) => setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  const chosen = rangeEvents.filter((e) => selected[e.id]);

  const grandTotal = chosen.reduce(
    (acc, e) => ({
      entrees: acc.entrees + (e.samplesNeeded || 0),
      breakfasts: acc.breakfasts + (e.breakfastsNeeded || 0),
      snackBites: acc.snackBites + (e.snackBitesNeeded || 0),
    }),
    { entrees: 0, breakfasts: 0, snackBites: 0 }
  );

  // Breakdown of where the totals above are coming from — grouped by pickup location.
  const byLocation = {};
  chosen.forEach((e) => {
    const key = e.pickupLocation || 'No location set';
    if (!byLocation[key]) byLocation[key] = { location: key, entrees: 0, breakfasts: 0, snackBites: 0, eventCount: 0 };
    byLocation[key].entrees += e.samplesNeeded || 0;
    byLocation[key].breakfasts += e.breakfastsNeeded || 0;
    byLocation[key].snackBites += e.snackBitesNeeded || 0;
    byLocation[key].eventCount += 1;
  });
  const locationRows = Object.values(byLocation).sort((a, b) => a.location.localeCompare(b.location));

  const handleDownload = () => {
    const headers = ['Pickup Location', 'Entrees', 'Breakfasts', 'Snack Bites', 'Events'];
    const rows = locationRows.map((r) => [r.location, r.entrees, r.breakfasts, r.snackBites, r.eventCount]);
    rows.push(['TOTAL', grandTotal.entrees, grandTotal.breakfasts, grandTotal.snackBites, chosen.length]);
    const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
    downloadCsvBlob(`rebuilt-projections-${toInputValue(new Date())}.csv`, csv);
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Uncheck any event below to leave it out of the totals — everything in the selected date range starts checked.
      </p>

      {rangeEvents.length === 0 ? (
        <Card className="p-8"><EmptyState icon="📦" title="No entrees/breakfasts/snack bites needed" description="Events appear here once they have sample entrees, breakfasts, or snack bites set" /></Card>
      ) : (
        <>
          <Card className="divide-y divide-slate-50">
            {rangeEvents.map((e) => (
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
                  {e.samplesNeeded ? <div>{e.samplesNeeded} entrees</div> : null}
                  {e.breakfastsNeeded ? <div>{e.breakfastsNeeded} breakfasts</div> : null}
                  {e.snackBitesNeeded ? <div>{e.snackBitesNeeded} snacks</div> : null}
                </div>
              </label>
            ))}
          </Card>

          {/* Prominent total */}
          <Card className="p-5 bg-mint-50 border-mint-200">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-semibold text-mint-700 uppercase tracking-wide mb-2">Total ({chosen.length} event{chosen.length !== 1 ? 's' : ''} selected)</p>
                <div className="flex items-baseline gap-6">
                  <div><span className="text-3xl font-bold text-slate-800">{grandTotal.entrees}</span> <span className="text-sm text-slate-500">entrees</span></div>
                  <div><span className="text-3xl font-bold text-slate-800">{grandTotal.breakfasts}</span> <span className="text-sm text-slate-500">breakfasts</span></div>
                  <div><span className="text-3xl font-bold text-slate-800">{grandTotal.snackBites}</span> <span className="text-sm text-slate-500">snack bites</span></div>
                </div>
              </div>
              <Button onClick={handleDownload} disabled={chosen.length === 0} className="flex items-center gap-1.5">
                <Download size={14} /> Download CSV
              </Button>
            </div>
          </Card>

          {/* Breakdown by pickup location */}
          <Card className="overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h2 className="font-semibold text-slate-700 text-sm">Breakdown by Pickup Location</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3">Pickup Location</th>
                  <th className="text-right px-5 py-3">Entrees</th>
                  <th className="text-right px-5 py-3">Breakfasts</th>
                  <th className="text-right px-5 py-3">Snack Bites</th>
                  <th className="text-right px-5 py-3">Events</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {locationRows.map((r) => (
                  <tr key={r.location}>
                    <td className={`px-5 py-3.5 font-medium ${r.location === 'No location set' ? 'text-amber-600' : 'text-slate-700'}`}>
                      {r.location}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-700">{r.entrees || '—'}</td>
                    <td className="px-5 py-3.5 text-right text-slate-700">{r.breakfasts || '—'}</td>
                    <td className="px-5 py-3.5 text-right text-slate-700">{r.snackBites || '—'}</td>
                    <td className="px-5 py-3.5 text-right text-slate-400">{r.eventCount}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  <td className="px-5 py-3.5 text-slate-800">Total</td>
                  <td className="px-5 py-3.5 text-right text-slate-800">{grandTotal.entrees}</td>
                  <td className="px-5 py-3.5 text-right text-slate-800">{grandTotal.breakfasts}</td>
                  <td className="px-5 py-3.5 text-right text-slate-800">{grandTotal.snackBites}</td>
                  <td className="px-5 py-3.5 text-right text-slate-600">{chosen.length}</td>
                </tr>
              </tfoot>
            </table>
          </Card>
        </>
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
    return d >= range.start && d < addDays(range.end, 1) && ((e.samplesNeeded || 0) > 0 || (e.breakfastsNeeded || 0) > 0 || (e.snackBitesNeeded || 0) > 0);
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
      const bags = computeBags(e.samplesNeeded, e.breakfastsNeeded, e.snackBitesNeeded);
      return bags.map((bag, i) => ({
        title: e.title,
        pickupLocation: e.pickupLocation || '',
        date: e.date,
        bagIndex: i + 1,
        bagCount: bags.length,
        meals: bag.meals,
        breakfasts: bag.breakfasts,
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
        <Card className="p-8"><EmptyState icon="🏷️" title="No events need bag tags in this range" description="Events show up here once they have sample entrees, breakfasts, or snack bites set" /></Card>
      ) : (
        <Card className="divide-y divide-slate-50">
          {rangeEvents.map((e) => {
            const bags = computeBags(e.samplesNeeded, e.breakfastsNeeded, e.snackBitesNeeded);
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
                  {e.samplesNeeded ? <div>{e.samplesNeeded} entrees</div> : null}
                  {e.breakfastsNeeded ? <div>{e.breakfastsNeeded} breakfasts</div> : null}
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
