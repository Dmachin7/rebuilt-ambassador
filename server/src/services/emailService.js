const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || 'onboarding@resend.dev';

function fmt(date) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function fmtTime(date) {
  return new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

async function send({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[EMAIL STUB] To: ${Array.isArray(to) ? to.join(', ') : to} | Subject: ${subject}`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error('[EMAIL ERROR]', err.message);
  }
}

async function sendWelcomeEmail(ambassador, setPasswordUrl) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;background:#f9f9f9;border-radius:8px">
      <h1 style="color:#2d6a4f;margin-bottom:4px">Welcome to ReBuilt, ${ambassador.firstName}! 🎉</h1>
      <p style="color:#555;margin-top:0">You've been added to the <strong>ReBuilt Brand Ambassador Program</strong>. We're excited to have you on the team.</p>
      <hr style="border:none;border-top:1px solid #ddd;margin:24px 0"/>
      <h3 style="color:#333">Your account</h3>
      <p style="color:#555"><strong>Email:</strong> ${ambassador.email}</p>
      <p style="color:#555">Before you can log in, you'll need to set your own password. Click the button below — the link expires in 72 hours.</p>
      <a href="${setPasswordUrl}" style="display:inline-block;margin:16px 0;padding:14px 28px;background:#2d6a4f;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px">
        Set My Password
      </a>
      <p style="color:#999;font-size:13px">If the button doesn't work, copy this link into your browser:<br/><span style="color:#2d6a4f">${setPasswordUrl}</span></p>
      <hr style="border:none;border-top:1px solid #ddd;margin:24px 0"/>
      <p style="color:#555">Once your password is set, log in at <a href="${process.env.FRONTEND_URL}" style="color:#2d6a4f">${process.env.FRONTEND_URL}</a> to see your upcoming shifts, check in to events, and track your earnings.</p>
      <p style="color:#555">Questions? Reply to this email or contact your event coordinator.</p>
      <p style="color:#aaa;font-size:12px;margin-top:32px">ReBuilt Meals Ambassador Platform</p>
    </div>
  `;
  await send({ to: ambassador.email, subject: 'Welcome to the ReBuilt Ambassador Program', html });
}

async function sendShiftAssignedEmail(ambassador, event, isAssigned = true) {
  const action = isAssigned ? "You've been assigned to" : "You've claimed";
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;background:#f9f9f9;border-radius:8px">
      <h2 style="color:#2d6a4f">Shift Confirmed, ${ambassador.firstName}!</h2>
      <p style="color:#555">${action} a shift. Here are your details:</p>
      <div style="background:#fff;border-radius:6px;padding:20px;margin:16px 0;border:1px solid #e0e0e0">
        <p style="margin:6px 0;color:#333"><strong>Event:</strong> ${event.title}</p>
        <p style="margin:6px 0;color:#333"><strong>Date:</strong> ${fmt(event.date)}</p>
        ${event.endTime ? `<p style="margin:6px 0;color:#333"><strong>Time:</strong> ${fmtTime(event.date)} – ${fmtTime(event.endTime)}</p>` : `<p style="margin:6px 0;color:#333"><strong>Start:</strong> ${fmtTime(event.date)}</p>`}
        <p style="margin:6px 0;color:#333"><strong>Location:</strong> ${event.location}</p>
        ${event.contactName ? `<p style="margin:6px 0;color:#333"><strong>On-Site Contact:</strong> ${event.contactName}${event.contactPhone ? ` · ${event.contactPhone}` : ''}</p>` : ''}
        ${event.notes ? `<p style="margin:6px 0;color:#555"><strong>Notes:</strong> ${event.notes}</p>` : ''}
      </div>
      <p style="color:#555">Log in to <a href="${process.env.FRONTEND_URL}" style="color:#2d6a4f">your dashboard</a> to view full details and check in on the day.</p>
      <p style="color:#aaa;font-size:12px;margin-top:32px">ReBuilt Meals Ambassador Platform</p>
    </div>
  `;
  await send({ to: ambassador.email, subject: `Shift Confirmed: ${event.title} on ${fmt(event.date)}`, html });
}

async function sendEventReminderEmail(ambassador, event, hoursAway) {
  const label = hoursAway <= 2 ? '⏰ Starting in about 1 hour' : '📅 Tomorrow';
  const urgency = hoursAway <= 2 ? 'Your shift starts in about an hour' : "Your shift is tomorrow";
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;background:#f9f9f9;border-radius:8px">
      <h2 style="color:#2d6a4f">${label} — ${event.title}</h2>
      <p style="color:#555">Hey ${ambassador.firstName}, ${urgency}. Here's a quick reminder:</p>
      <div style="background:#fff;border-radius:6px;padding:20px;margin:16px 0;border:1px solid #e0e0e0">
        <p style="margin:6px 0;color:#333"><strong>Event:</strong> ${event.title}</p>
        <p style="margin:6px 0;color:#333"><strong>Date:</strong> ${fmt(event.date)}</p>
        ${event.endTime ? `<p style="margin:6px 0;color:#333"><strong>Time:</strong> ${fmtTime(event.date)} – ${fmtTime(event.endTime)}</p>` : `<p style="margin:6px 0;color:#333"><strong>Start:</strong> ${fmtTime(event.date)}</p>`}
        <p style="margin:6px 0;color:#333"><strong>Location:</strong> ${event.location}</p>
        ${event.contactName ? `<p style="margin:6px 0;color:#333"><strong>On-Site Contact:</strong> ${event.contactName}${event.contactPhone ? ` · ${event.contactPhone}` : ''}</p>` : ''}
        ${event.setupTimeMins ? `<p style="margin:6px 0;color:#555"><strong>Setup time:</strong> ${event.setupTimeMins} min before start</p>` : ''}
      </div>
      <p style="color:#555">Open the app to check in when you arrive: <a href="${process.env.FRONTEND_URL}" style="color:#2d6a4f">${process.env.FRONTEND_URL}</a></p>
      <p style="color:#aaa;font-size:12px;margin-top:32px">ReBuilt Meals Ambassador Platform</p>
    </div>
  `;
  const subjectLabel = hoursAway <= 2 ? 'Starting Soon' : 'Tomorrow';
  await send({ to: ambassador.email, subject: `Reminder [${subjectLabel}]: ${event.title}`, html });
}

async function sendPostEventRecapEmail(staffEmails, event, shifts) {
  const completed = shifts.filter((s) => s.status === 'COMPLETED' || s.status === 'CHECKED_IN');
  const ambassadorRows = completed.map((s) => {
    const name = s.ambassador ? `${s.ambassador.firstName} ${s.ambassador.lastName}` : 'Unassigned';
    const hours = s.checkoutTime && s.checkinTime
      ? ((new Date(s.checkoutTime) - new Date(s.checkinTime)) / 3600000).toFixed(1)
      : '—';
    return `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${name}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:center">${hours}</td></tr>`;
  }).join('');

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;background:#f9f9f9;border-radius:8px">
      <h2 style="color:#2d6a4f">Event Recap: ${event.title}</h2>
      <p style="color:#555">The following event has been marked <strong>Completed</strong>.</p>
      <div style="background:#fff;border-radius:6px;padding:20px;margin:16px 0;border:1px solid #e0e0e0">
        <p style="margin:6px 0;color:#333"><strong>Event:</strong> ${event.title}</p>
        <p style="margin:6px 0;color:#333"><strong>Date:</strong> ${fmt(event.date)}</p>
        <p style="margin:6px 0;color:#333"><strong>Location:</strong> ${event.location}</p>
        ${event.totalMealsSold != null ? `<p style="margin:6px 0;color:#333"><strong>Total Meals Sold:</strong> ${event.totalMealsSold}</p>` : ''}
        ${event.totalSalesInput != null ? `<p style="margin:6px 0;color:#333"><strong>Total Sales (transactions):</strong> ${event.totalSalesInput}</p>` : ''}
      </div>
      ${completed.length > 0 ? `
      <h3 style="color:#333">Ambassador Hours</h3>
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:6px;overflow:hidden;border:1px solid #e0e0e0">
        <thead><tr style="background:#2d6a4f;color:#fff">
          <th style="padding:8px 12px;text-align:left">Ambassador</th>
          <th style="padding:8px 12px;text-align:center">Hours Worked</th>
        </tr></thead>
        <tbody>${ambassadorRows}</tbody>
      </table>` : '<p style="color:#555">No completed shifts recorded.</p>'}
      <p style="color:#555;margin-top:24px">View the full report in the <a href="${process.env.FRONTEND_URL}/admin/reports" style="color:#2d6a4f">admin reports dashboard</a>.</p>
      <p style="color:#aaa;font-size:12px;margin-top:32px">ReBuilt Meals Ambassador Platform</p>
    </div>
  `;
  await send({ to: staffEmails, subject: `Event Recap: ${event.title} — ${fmt(event.date)}`, html });
}

async function sendDailySummary(adminEmails, summary) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;background:#f9f9f9;border-radius:8px">
      <h2 style="color:#2d6a4f">Daily Summary — ${summary.date}</h2>
      <div style="background:#fff;border-radius:6px;padding:20px;margin:16px 0;border:1px solid #e0e0e0">
        <p style="margin:6px 0;color:#333"><strong>Shifts Completed:</strong> ${summary.shiftsCompleted}</p>
        <p style="margin:6px 0;color:#333"><strong>Total Hours:</strong> ${summary.totalHours}</p>
        <p style="margin:6px 0;color:#333"><strong>Total Meals Sold:</strong> ${summary.totalMealsSold}</p>
      </div>
      <p style="color:#aaa;font-size:12px;margin-top:32px">ReBuilt Meals Ambassador Platform</p>
    </div>
  `;
  await send({ to: adminEmails, subject: `ReBuilt Daily Summary — ${summary.date}`, html });
}

async function sendWeeklyNotification(adminEmails, summary) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;background:#f9f9f9;border-radius:8px">
      <h2 style="color:#2d6a4f">Weekly Summary</h2>
      <p style="color:#555">${summary.weekStart} – ${summary.weekEnd}</p>
      <div style="background:#fff;border-radius:6px;padding:20px;margin:16px 0;border:1px solid #e0e0e0">
        <p style="margin:6px 0;color:#333"><strong>Shifts Completed:</strong> ${summary.shiftsCompleted}</p>
        <p style="margin:6px 0;color:#333"><strong>Total Hours:</strong> ${summary.totalHours}</p>
        <p style="margin:6px 0;color:#333"><strong>Total Meals Sold:</strong> ${summary.totalMealsSold}</p>
        <p style="margin:6px 0;color:#333"><strong>Total Sales (transactions):</strong> ${summary.totalSales}</p>
      </div>
      <p style="color:#aaa;font-size:12px;margin-top:32px">ReBuilt Meals Ambassador Platform</p>
    </div>
  `;
  await send({ to: adminEmails, subject: `ReBuilt Weekly Summary: ${summary.weekStart} – ${summary.weekEnd}`, html });
}

module.exports = {
  sendWelcomeEmail,
  sendShiftAssignedEmail,
  sendEventReminderEmail,
  sendPostEventRecapEmail,
  sendDailySummary,
  sendWeeklyNotification,
};
