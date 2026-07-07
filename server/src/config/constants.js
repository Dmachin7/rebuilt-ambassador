// Home base — origin point for all event drive distance/time calculations
const HQ_ADDRESS = process.env.REBUILT_HQ_ADDRESS || '4618 N Hale Ave, Tampa, FL 33614';

// Mileage reimbursement, paid on round-trip miles from HQ
const MILEAGE_RATE = 0.30;

// Minimum paid hours per shift, inclusive of round-trip drive time
const MIN_PAID_HOURS = 4;

module.exports = { HQ_ADDRESS, MILEAGE_RATE, MIN_PAID_HOURS };
