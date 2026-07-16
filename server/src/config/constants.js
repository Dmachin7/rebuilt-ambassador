// Home base — origin point for all event drive distance/time calculations
const HQ_ADDRESS = process.env.REBUILT_HQ_ADDRESS || '4618 N Hale Ave, Tampa, FL 33614';

// Mileage reimbursement, paid on round-trip miles from HQ
const MILEAGE_RATE = 0.30;

// Flat hourly pay rate — applied to on-site event time (which already covers setup, since
// ambassadors check in when they arrive to set up) and round-trip drive time
const HOURLY_RATE = 20;

// Minimum paid hours per shift, inclusive of round-trip drive time
const MIN_PAID_HOURS = 4;

// Per-sale commission tiers, based on the sale's dollar amount
const SALE_AMOUNT_THRESHOLD = 99;
const COMMISSION_UNDER_THRESHOLD = 20;
const COMMISSION_OVER_THRESHOLD = 40;

module.exports = {
  HQ_ADDRESS,
  MILEAGE_RATE,
  HOURLY_RATE,
  MIN_PAID_HOURS,
  SALE_AMOUNT_THRESHOLD,
  COMMISSION_UNDER_THRESHOLD,
  COMMISSION_OVER_THRESHOLD,
};
