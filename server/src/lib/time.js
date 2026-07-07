// An ambassador's actual arrival/start time = event start time minus setup time.
function computeArrivalTime(event) {
  if (!event?.date) return null;
  const setupMins = event.setupTimeMins || 0;
  return new Date(new Date(event.date).getTime() - setupMins * 60000).toISOString();
}

function withArrivalTime(event) {
  if (!event) return event;
  return { ...event, arrivalTime: computeArrivalTime(event) };
}

function withShiftArrivalTime(shift) {
  if (!shift?.event) return shift;
  return { ...shift, event: withArrivalTime(shift.event) };
}

module.exports = { computeArrivalTime, withArrivalTime, withShiftArrivalTime };
