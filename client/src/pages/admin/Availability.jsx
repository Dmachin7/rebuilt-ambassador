import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usersAPI, availabilityAPI } from '../../api/index.js';
import { Card, Select, Spinner, EmptyState } from '../../components/ui/index.jsx';
import AvailabilityCalendar from '../../components/AvailabilityCalendar.jsx';
import TeamAvailabilityGrid from '../../components/TeamAvailabilityGrid.jsx';

export default function AdminAvailability() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [ambassadors, setAmbassadors] = useState([]);
  const [loading, setLoading] = useState(true);
  const mode = searchParams.get('view') === 'single' ? 'single' : 'team';
  const selectedId = searchParams.get('ambassadorId') || '';

  useEffect(() => {
    usersAPI.list('AMBASSADOR').then((list) => {
      setAmbassadors(list);
      if (!selectedId && list.length > 0) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set('ambassadorId', list[0].id);
          return next;
        }, { replace: true });
      }
    }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setMode = (next) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('view', next);
      return params;
    });
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Ambassador Availability</h1>
        <p className="text-sm text-slate-500">View and edit when ambassadors are open, unavailable, or have limited hours.</p>
      </div>

      {ambassadors.length === 0 ? (
        <Card className="p-8"><EmptyState icon="🗓️" title="No ambassadors found" /></Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
              <button
                type="button"
                onClick={() => setMode('team')}
                className={`px-3 py-1.5 rounded-md transition-colors ${mode === 'team' ? 'bg-mint-300 text-slate-800 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Team View
              </button>
              <button
                type="button"
                onClick={() => setMode('single')}
                className={`px-3 py-1.5 rounded-md transition-colors ${mode === 'single' ? 'bg-mint-300 text-slate-800 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Single Ambassador
              </button>
            </div>

            {mode === 'single' && (
              <div className="max-w-xs">
                <Select value={selectedId} onChange={(e) => setSearchParams((prev) => {
                  const params = new URLSearchParams(prev);
                  params.set('ambassadorId', e.target.value);
                  return params;
                })}>
                  {ambassadors.map((a) => (
                    <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          {mode === 'team' ? (
            <TeamAvailabilityGrid ambassadors={ambassadors} />
          ) : (
            selectedId && (
              <AvailabilityCalendar
                key={selectedId}
                userId={selectedId}
                editable
                onSave={(days) => availabilityAPI.setFor(selectedId, days)}
              />
            )
          )}
        </>
      )}
    </div>
  );
}
