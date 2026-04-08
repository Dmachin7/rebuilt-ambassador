import React, { useEffect, useState } from 'react';
import { leaderboardAPI } from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Card, Spinner, EmptyState } from '../../components/ui/index.jsx';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function AmbassadorLeaderboard() {
  const { user } = useAuth();
  const now = new Date();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    leaderboardAPI.get(now.getMonth() + 1, now.getFullYear()).then(setData).finally(() => setLoading(false));
  }, []);

  const myEntry = data?.entries?.find((e) => e.user.id === user?.id);

  const rankIcon = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;

  return (
    <div className="px-4 py-5 space-y-5 max-w-lg mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-800">🏆 Leaderboard</h1>
        <p className="text-sm text-slate-500">
          Cook Less, Sell More — {MONTHS[(data?.month || 1) - 1]} {data?.year}
        </p>
      </div>

      {/* My rank card */}
      {myEntry ? (
        <Card className="p-4 bg-mint-50 border-mint-300">
          <p className="text-xs font-semibold text-mint-600 mb-2 uppercase tracking-wide">Your Standing</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">{rankIcon(myEntry.rank)}</div>
              <div>
                <div className="font-bold text-slate-800">{myEntry.totalPoints} pts</div>
                <div className="text-xs text-slate-500">{myEntry.promosWorked} promos worked{myEntry.promosWorked < 15 ? ' — need 15 to qualify' : ''}</div>
              </div>
            </div>
            {myEntry.promosWorked < 15 && (
              <div className="text-right">
                <div className="text-xs text-orange-600 font-medium">{15 - myEntry.promosWorked} more</div>
                <div className="text-xs text-slate-400">to qualify</div>
              </div>
            )}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-center">
            <div className="bg-white rounded-lg p-2">
              <div className="font-bold text-slate-700">{myEntry.noZeroSalePromos * 5}</div>
              <div className="text-slate-400">No-zero pts</div>
            </div>
            <div className="bg-white rounded-lg p-2">
              <div className="font-bold text-slate-700">{myEntry.weeklyBenchmarks * 15}</div>
              <div className="text-slate-400">Weekly pts</div>
            </div>
            <div className="bg-white rounded-lg p-2">
              <div className="font-bold text-mint-600">{myEntry.avgMealsPerSale.toFixed(1)}</div>
              <div className="text-slate-400">Meals/sale</div>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-4 bg-orange-50 border-orange-200">
          <p className="text-sm text-orange-700">You don't have a leaderboard entry for this month yet. Complete promos to get on the board!</p>
        </Card>
      )}

      {/* Full leaderboard */}
      {!data?.entries?.length ? (
        <Card className="p-6"><EmptyState icon="🏆" title="No data for this month" /></Card>
      ) : (
        <div className="space-y-2">
          {data.entries.map((entry) => {
            const isMe = entry.user.id === user?.id;
            return (
              <Card key={entry.id} className={`px-4 py-3 flex items-center gap-3 ${isMe ? 'border-mint-300 bg-mint-50' : ''}`}>
                <div className={`w-8 text-center font-bold ${entry.rank === 1 ? 'text-yellow-500 text-lg' : entry.rank === 2 ? 'text-slate-400' : entry.rank === 3 ? 'text-amber-600' : 'text-slate-400 text-sm'}`}>
                  {rankIcon(entry.rank)}
                </div>
                <div className="w-8 h-8 bg-mint-100 rounded-full flex items-center justify-center text-xs font-bold text-mint-700 shrink-0">
                  {entry.user.firstName[0]}{entry.user.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${isMe ? 'text-mint-700' : 'text-slate-700'}`}>
                    {entry.user.firstName} {entry.user.lastName}
                    {isMe && <span className="ml-1 text-xs text-mint-500">(you)</span>}
                  </div>
                  <div className="text-xs text-slate-400">{entry.promosWorked} promos · {entry.avgMealsPerSale.toFixed(1)} avg meals/sale</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-slate-800">{entry.totalPoints}</div>
                  <div className="text-xs text-slate-400">pts</div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-400 text-center">Resets on the 1st of each month. Minimum 15 promos to qualify.</p>
    </div>
  );
}
