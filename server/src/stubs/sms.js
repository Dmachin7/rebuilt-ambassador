/**
 * ─── STUB: Twilio SMS Integration ─────────────────────────────────────────────
 *
 * sendSMSReminder
 *   Replace with: const twilio = require('twilio');
 *                 const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
 *                 client.messages.create({ body: message, from: TWILIO_PHONE_NUMBER, to: phone })
 *
 * sendUrgentAlert
 *   Same Twilio setup, loop over phone numbers (or use Twilio Notify for broadcast)
 *
 * Env vars needed: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 *
 * Tip: Schedule reminders with node-cron or a job queue (Bull/BullMQ):
 *   - 24h before: shiftDate - 24*60*60*1000
 *   - 2h before:  shiftDate - 2*60*60*1000
 */

const sendSMSReminder = async (phone, message, hoursUntilShift) => {
  // STUB — logs to console, replace with Twilio
  console.log(`[STUB sms.js] sendSMSReminder (${hoursUntilShift}h reminder)`);
  console.log(`  → TO:  ${phone}`);
  console.log(`  → MSG: ${message}`);
  return { success: true, mock: true };
};

const sendUrgentAlert = async (phones, message) => {
  // STUB — logs to console, replace with Twilio broadcast
  console.log(`[STUB sms.js] sendUrgentAlert → ${phones.length} recipients`);
  console.log(`  → MSG: ${message}`);
  phones.forEach((p) => console.log(`  → ${p}`));
  return { success: true, mock: true, count: phones.length };
};

module.exports = { sendSMSReminder, sendUrgentAlert };
