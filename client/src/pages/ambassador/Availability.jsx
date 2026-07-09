import React from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { availabilityAPI } from '../../api/index.js';
import AvailabilityCalendar from '../../components/AvailabilityCalendar.jsx';

const todayStr = () => new Date().toISOString().slice(0, 10);
const addDaysStr = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export default function AmbassadorAvailability() {
  const { user } = useAuth();

  return (
    <div className="px-4 py-5 space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-800">My Availability</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Set your availability up to a month ahead — tap a day (or drag across several) to mark it Open, Not Available, or Other.
        </p>
      </div>
      <AvailabilityCalendar
        userId={user.id}
        editable
        validRange={{ start: todayStr(), end: addDaysStr(31) }}
        onSave={(days) => availabilityAPI.setMine(days)}
      />
    </div>
  );
}
