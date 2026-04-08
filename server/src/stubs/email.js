/**
 * Email notification stubs — replace with SendGrid or Nodemailer in production.
 *
 * To wire in real email:
 *   npm install @sendgrid/mail
 *   Replace the console.log bodies with sgMail.send({ to, from, subject, text })
 *
 * Stub functions are intentionally async so production drop-ins require no caller changes.
 *
 * See README → "Swapping in Real Integrations" for setup details.
 */

/**
 * Daily end-of-day summary sent to admins.
 * @param {string[]} adminEmails
 * @param {{ date: string, shiftsCompleted: number, totalHours: number, totalMealsSold: number }} summary
 */
async function sendDailySummary(adminEmails, summary) {
  console.log('[STUB EMAIL] Daily summary (SendGrid not yet wired)');
  console.log(`  To: ${adminEmails.join(', ')}`);
  console.log(`  Date: ${summary.date}`);
  console.log(`  Shifts completed: ${summary.shiftsCompleted}`);
  console.log(`  Total hours: ${summary.totalHours}`);
  console.log(`  Total Meals Sold: ${summary.totalMealsSold}`);
}

/**
 * Weekly summary notification sent to admins every Monday.
 * @param {string[]} adminEmails
 * @param {{ weekStart: string, weekEnd: string, shiftsCompleted: number, totalHours: number, totalMealsSold: number, totalSales: number }} summary
 */
async function sendWeeklyNotification(adminEmails, summary) {
  console.log('[STUB EMAIL] Weekly notification (SendGrid not yet wired)');
  console.log(`  To: ${adminEmails.join(', ')}`);
  console.log(`  Week: ${summary.weekStart} – ${summary.weekEnd}`);
  console.log(`  Shifts completed: ${summary.shiftsCompleted}`);
  console.log(`  Total hours: ${summary.totalHours}`);
  console.log(`  Total Meals Sold: ${summary.totalMealsSold}`);
  console.log(`  Total Sales (transactions): ${summary.totalSales}`);
}

module.exports = { sendDailySummary, sendWeeklyNotification };
