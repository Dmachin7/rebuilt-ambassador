import React, { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Button } from './ui/index.jsx';

export const startOfWeekMonday = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
};
export const addDays = (date, n) => new Date(date.getTime() + n * 86400000);

// Local (not UTC) YYYY-MM-DD so the value sent to the API matches the calendar day
// shown, regardless of timezone offset.
export const toInputValue = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Single-calendar click-start-then-click-end range picker (react-datepicker in selectsRange
// mode), plus Prev/Next (shifts by the range's own length) and a This Week reset. Shared by
// any admin page that needs to filter by an arbitrary date range — Exports, Analytics, etc.
export default function DateRangeControl({ range, onChange }) {
  // Mirrors `range` but also tracks an in-progress selection (start clicked, end not yet)
  // before it's committed upward — react-datepicker fires onChange with a null end mid-pick.
  const [pending, setPending] = useState([range.start, range.end]);

  useEffect(() => {
    setPending([range.start, range.end]);
  }, [range.start, range.end]);

  const rangeDays = Math.round((range.end - range.start) / 86400000) + 1;
  const shiftRange = (days) => onChange({ start: addDays(range.start, days), end: addDays(range.end, days) });
  const resetToThisWeek = () => {
    const start = startOfWeekMonday(new Date());
    onChange({ start, end: addDays(start, 6) });
  };

  const handlePickerChange = (dates) => {
    const [start, end] = dates;
    setPending([start, end]);
    if (start && end) onChange({ start, end });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button variant="secondary" size="sm" onClick={() => shiftRange(-rangeDays)}>‹</Button>
      <DatePicker
        selectsRange
        startDate={pending[0]}
        endDate={pending[1]}
        onChange={handlePickerChange}
        dateFormat="MMM d, yyyy"
        calendarStartDay={1}
        className="input-field !w-56 text-sm py-1.5"
      />
      <Button variant="secondary" size="sm" onClick={() => shiftRange(rangeDays)}>›</Button>
      <Button variant="secondary" size="sm" onClick={resetToThisWeek}>This Week</Button>
    </div>
  );
}
