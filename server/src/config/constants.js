// Home base — origin point for all event drive distance/time calculations
const HQ_ADDRESS = process.env.REBUILT_HQ_ADDRESS || '4618 N Hale Ave, Tampa, FL 33614';

// Mileage reimbursement, paid on round-trip miles from HQ
const MILEAGE_RATE = 0.30;

// Minimum paid hours per shift, inclusive of round-trip drive time
const MIN_PAID_HOURS = 4;

// Check-in geofence radius, plus a capped grace allowance added on top of the device's own
// reported GPS accuracy — browsers (especially laptops, or indoors) often report low-confidence
// locations that can be off by hundreds of feet even when the ambassador is genuinely on-site.
// 1000ft accounts for large venue footprints (plazas, malls, parking lots) where the geocoded
// address point can be far from where an ambassador is actually set up.
const CHECKIN_RADIUS_FEET = 1000;
const CHECKIN_RADIUS_METERS = CHECKIN_RADIUS_FEET * 0.3048;
const CHECKIN_MAX_ACCURACY_GRACE_METERS = 500;

// Per-sale commission tiers, based on the sale's dollar amount
const SALE_AMOUNT_THRESHOLD = 99;
const COMMISSION_UNDER_THRESHOLD = 20;
const COMMISSION_OVER_THRESHOLD = 40;

module.exports = {
  HQ_ADDRESS,
  MILEAGE_RATE,
  MIN_PAID_HOURS,
  CHECKIN_RADIUS_FEET,
  CHECKIN_RADIUS_METERS,
  CHECKIN_MAX_ACCURACY_GRACE_METERS,
  SALE_AMOUNT_THRESHOLD,
  COMMISSION_UNDER_THRESHOLD,
  COMMISSION_OVER_THRESHOLD,
};
