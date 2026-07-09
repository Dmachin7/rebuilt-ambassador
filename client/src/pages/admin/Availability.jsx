import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usersAPI, availabilityAPI } from '../../api/index.js';
import { Card, Select, Spinner, EmptyState } from '../../components/ui/index.jsx';
import AvailabilityCalendar from '../../components/AvailabilityCalendar.jsx';

export default function AdminAvailability() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [ambassadors, setAmbassadors] = useState([]);
  const [loading, setLoading] = useState(true);
  const selectedId = searchParams.get('ambassadorId') || '';

  useEffect(() => {
    usersAPI.list('AMBASSADOR').then((list) => {
      setAmbassadors(list);
      if (!selectedId && list.length > 0) {
        setSearchParams({ ambassadorId: list[0].id }, { replace: true });
      }
    }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <div className="max-w-xs">
            <Select value={selectedId} onChange={(e) => setSearchParams({ ambassadorId: e.target.value })}>
              {ambassadors.map((a) => (
                <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
              ))}
            </Select>
          </div>

          {selectedId && (
            <AvailabilityCalendar
              key={selectedId}
              userId={selectedId}
              editable
              onSave={(days) => availabilityAPI.setFor(selectedId, days)}
            />
          )}
        </>
      )}
    </div>
  );
}
