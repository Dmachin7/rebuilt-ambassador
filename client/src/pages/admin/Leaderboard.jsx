import React, { useEffect, useState } from 'react';
import { leaderboardAPI } from '../../api/index.js';
import { Card, Spinner, EmptyState } from '../../components/ui/index.jsx';
import { Trophy, Medal } from 'lucide-react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function PointsBreakdown({ entry }) {
  const consistency = entry.promosWorked >= 15 ? 10 + (entry.promosWorked - 15) : 0;
  const quality = entry.avgMealsPerSale >= 9 ? 15 : entry.avgMealsPerSale >= 8 ? 10 : entry.avgMealsPerSale >= 7 ? 7 : 0;
  const rows = [
    ['Consistency (15+ promos)', `${entry.promosWorked} promos`, consistency, entry.promosWorked < 15 ? 'text-red-400' : 'text-green-600'],
    ['No-Zero Promos ×5', `${entry.noZeroSalePromos} promos`, entry.noZeroSalePromos * 5, 'text-green-600'],
    ['Strong Performance ×7', `${entry.strongPerformance} promos`, entry.strongPerformance * 7, 'text-green-600'],
    ['Weekly Benchmark ×15', `${entry.weeklyBenchmarks} weeks`, entry.weeklyBenchmarks * 15, 'text-green-600'],
    ['Retention Penalty ×−2', `${entry.retentionPenalty} cancellations`, -entry.retentionPenalty * 2, entry.retentionPenalty > 0 ? 'text-red-500' : 'text-slate-400'],
    ['Avg Meals/Sale Bonus', `${entry.avgMealsPerSale.toFixed(1)} avg`, quality, quality > 0 ? 'text-green-600' : 'text-slate-400'],
  ];
  return (
    <div className="mt-2 text-xs space-y-1">
      {rows.map(([label, detail, pts, cls]) => (
        <div key={label} className="flex justify-between">
          <span className="text-slate-500">{label} <span className="text-slate-400">({detail})</span></span>
          <span className={`font-medium ${cls}`}>{pts >= 0 ? '+' : ''}{pts}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminLeaderboard() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const load = () => {
    setLoading(true);
    leaderboardAPI.get(month, year).then(setData).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [month, year]);

  const rankIcon = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Leaderboard</h1>
          <p className="text-sm text-slate-500">Cook Less, Sell More — monthly competition</p>
        </div>
        <div className="flex gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="input-field w-28 text-sm"
          >
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="input-field w-24 text-sm"
          >
            {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Scoring rules */}
      <Card className="p-4 bg-mint-50 border-mint-200">
        <p className="text-xs font-semibold text-mint-700 mb-2 uppercase tracking-wide">Scoring Rules</p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600">
          <div>✓ 15+ promos: 10 pts base + 1pt each above 15</div>
          <div>✓ No-zero promo: +5 pts each</div>
          <div>✓ 3+ sales promo: +7 pts each</div>
          <div>✓ Week with 10+ sales: +15 pts</div>
          <div>✓ Avg 7–7.99 meals/sale: +7 pts</div>
          <div>✓ Avg 8–8.99 meals/sale: +10 pts</div>
          <div>✓ Avg 9+ meals/sale: +15 pts</div>
          <div className="text-red-500">✗ Cancellation after 1st order: −2 pts each</div>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>
      ) : !data?.entries?.length ? (
        <Card className="p-8"><EmptyState icon="🏆" title="No data for this period" description="Leaderboard resets monthly" /></Card>
      ) : (
        <div className="space-y-3">
          {data.entries.map((entry) => (
            <Card key={entry.id} className={`overflow-hidden transition-all ${entry.rank <= 3 ? 'border-mint-300' : ''}`}>
              <button
                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-slate-50 transition-colors"
              >
                <div className={`w-10 text-center font-bold text-lg ${entry.rank === 1 ? 'text-yellow-500' : entry.rank === 2 ? 'text-slate-400' : entry.rank === 3 ? 'text-amber-600' : 'text-slate-500 text-sm'}`}>
                  {rankIcon(entry.rank)}
                </div>
                <div className="w-9 h-9 bg-mint-100 rounded-full flex items-center justify-center text-sm font-bold text-mint-700 shrink-0">
                  {entry.user.firstName[0]}{entry.user.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800">{entry.user.firstName} {entry.user.lastName}</div>
                  <div className="text-xs text-slate-400">{entry.promosWorked} promos worked{entry.promosWorked < 15 ? ' (not yet qualified)' : ''}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-bold text-slate-800">{entry.totalPoints}</div>
                  <div className="text-xs text-slate-400">points</div>
                </div>
              </button>
              {expanded === entry.id && (
                <div className="px-5 pb-4 border-t border-slate-100">
                  <PointsBreakdown entry={entry} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-400">* Leaderboard resets monthly. Click any ambassador to see their point breakdown.</p>
    </div>
  );
}
