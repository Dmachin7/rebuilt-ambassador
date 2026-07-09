const { Resend } = require('resend');
const { computeArrivalTime } = require('../lib/time');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || 'onboarding@resend.dev';

const DISPLAY_TZ = process.env.DISPLAY_TZ || 'America/New_York';

function fmt(date) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: DISPLAY_TZ,
  });
}

function fmtTime(date) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: DISPLAY_TZ,
  });
}

function arrivalLine(event) {
  if (!event.setupTimeMins) return '';
  return `<p style="margin:6px 0;color:#c2410c"><strong>Arrive by:</strong> ${fmtTime(computeArrivalTime(event))} (${event.setupTimeMins} min setup before start)</p>`;
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

async function sendWelcomeEmail(user, setPasswordUrl) {
  const isCoord = user.role === 'EVENT_COORDINATOR';
  const roleLabel = isCoord ? 'Event Coordinator' : 'Brand Ambassador';
  const portalNote = isCoord
    ? 'Once your password is set, log in to manage events, view shifts, and coordinate your team.'
    : "Once your password is set, log in to see your upcoming shifts, check in to events, and track your earnings.";

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;background:#f9f9f9;border-radius:8px">
      <h1 style="color:#2d6a4f;margin-bottom:4px">Welcome to ReBuilt, ${user.firstName}!</h1>
      <p style="color:#555;margin-top:0">You've been added to the ReBuilt platform as a <strong>${roleLabel}</strong>. We're excited to have you on the team.</p>
      <hr style="border:none;border-top:1px solid #ddd;margin:24px 0"/>
      <h3 style="color:#333">Your account</h3>
      <p style="color:#555"><strong>Email:</strong> ${user.email}</p>
      <p style="color:#555">Before you can log in, you'll need to set your own password. Click the button below — the link expires in 72 hours.</p>
      <a href="${setPasswordUrl}" style="display:inline-block;margin:16px 0;padding:14px 28px;background:#2d6a4f;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;font-size:16px">
        Set My Password
      </a>
      <p style="color:#999;font-size:13px">If the button doesn't work, copy this link into your browser:<br/><span style="color:#2d6a4f">${setPasswordUrl}</span></p>
      <hr style="border:none;border-top:1px solid #ddd;margin:24px 0"/>
      <p style="color:#555">${portalNote}</p>
      <p style="color:#555">Log in at <a href="${process.env.FRONTEND_URL}" style="color:#2d6a4f">${process.env.FRONTEND_URL}</a></p>
      <p style="color:#aaa;font-size:12px;margin-top:32px">ReBuilt Meals Platform</p>
    </div>
  `;
  await send({ to: user.email, subject: `Welcome to ReBuilt — Set Your Password`, html });
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
        ${arrivalLine(event)}
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
        ${arrivalLine(event)}
        <p style="margin:6px 0;color:#333"><strong>Location:</strong> ${event.location}</p>
        ${event.contactName ? `<p style="margin:6px 0;color:#333"><strong>On-Site Contact:</strong> ${event.contactName}${event.contactPhone ? ` · ${event.contactPhone}` : ''}</p>` : ''}
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

async function sendShiftPickupEmail(staffEmails, ambassador, event, action) {
  const actionLabel = action === 'claimed' ? 'picked up' : 'dropped';
  const emoji = action === 'claimed' ? '✅' : '⚠️';
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;background:#f9f9f9;border-radius:8px">
      <h2 style="color:#2d6a4f">${emoji} Shift ${actionLabel}: ${event.title}</h2>
      <p style="color:#555"><strong>${ambassador.firstName} ${ambassador.lastName}</strong> has ${actionLabel} a shift.</p>
      <div style="background:#fff;border-radius:6px;padding:20px;margin:16px 0;border:1px solid #e0e0e0">
        <p style="margin:6px 0;color:#333"><strong>Event:</strong> ${event.title}</p>
        <p style="margin:6px 0;color:#333"><strong>Date:</strong> ${fmt(event.date)}</p>
        ${event.endTime ? `<p style="margin:6px 0;color:#333"><strong>Time:</strong> ${fmtTime(event.date)} – ${fmtTime(event.endTime)}</p>` : `<p style="margin:6px 0;color:#333"><strong>Start:</strong> ${fmtTime(event.date)}</p>`}
        <p style="margin:6px 0;color:#333"><strong>Location:</strong> ${event.location}</p>
        <p style="margin:6px 0;color:#333"><strong>Ambassador:</strong> ${ambassador.firstName} ${ambassador.lastName} · ${ambassador.email}</p>
      </div>
      <p style="color:#555">View this event in the <a href="${process.env.FRONTEND_URL}/admin/events" style="color:#2d6a4f">event dashboard</a>.</p>
      <p style="color:#aaa;font-size:12px;margin-top:32px">ReBuilt Meals Platform</p>
    </div>
  `;
  await send({
    to: staffEmails,
    subject: `Shift ${actionLabel}: ${ambassador.firstName} ${ambassador.lastName} — ${event.title}`,
    html,
  });
}

async function sendSalesVerificationEmail(staffEmails, event, ambassador, report) {
  const ambassadorName = ambassador ? `${ambassador.firstName} ${ambassador.lastName}` : 'An ambassador';
  const rows = report.sales.map((sale, i) => `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #eee">#${i + 1}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee">${sale.overThreshold ? '$99+' : 'Under $99'}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right">$${sale.commission.toFixed(2)}</td>
    </tr>
  `).join('');
  const potentialCommission = report.sales.reduce((s, sale) => s + sale.commission, 0);

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;background:#f9f9f9;border-radius:8px">
      <h2 style="color:#2d6a4f">🧾 Sales to Verify: ${event.title}</h2>
      <p style="color:#555">${ambassadorName} reported <strong>${report.sales.length} sale${report.sales.length !== 1 ? 's' : ''}</strong> for this event. Check Shopify to confirm each sale's amount, then verify (or correct) it in the admin Reports page before payroll runs.</p>
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:6px;overflow:hidden;border:1px solid #e0e0e0;margin:16px 0">
        <thead><tr style="background:#2d6a4f;color:#fff">
          <th style="padding:8px 12px;text-align:left">Sale</th>
          <th style="padding:8px 12px;text-align:left">Ambassador's Claim</th>
          <th style="padding:8px 12px;text-align:right">Commission (unverified)</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#555;margin:0"><strong>Potential total commission:</strong> $${potentialCommission.toFixed(2)} (not yet payable — pending verification)</p>
      <p style="color:#555;margin-top:16px">Verify each sale in the <a href="${process.env.FRONTEND_URL}/admin/reports" style="color:#2d6a4f">admin reports dashboard</a>.</p>
      <p style="color:#aaa;font-size:12px;margin-top:32px">ReBuilt Meals Ambassador Platform</p>
    </div>
  `;
  await send({
    to: staffEmails,
    subject: `Verify Sales: ${ambassadorName} — ${event.title}`,
    html,
  });
}

async function sendCheckInNotificationEmail(adminEmails, ambassador, event) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;background:#f9f9f9;border-radius:8px">
      <h2 style="color:#2d6a4f">✅ Checked In: ${event.title}</h2>
      <p style="color:#555"><strong>${ambassador.firstName} ${ambassador.lastName}</strong> just checked in for this event.</p>
      <div style="background:#fff;border-radius:6px;padding:20px;margin:16px 0;border:1px solid #e0e0e0">
        <p style="margin:6px 0;color:#333"><strong>Event:</strong> ${event.title}</p>
        <p style="margin:6px 0;color:#333"><strong>Date:</strong> ${fmt(event.date)}</p>
        <p style="margin:6px 0;color:#333"><strong>Location:</strong> ${event.location}</p>
        <p style="margin:6px 0;color:#333"><strong>Ambassador:</strong> ${ambassador.firstName} ${ambassador.lastName} · ${ambassador.email}</p>
        <p style="margin:6px 0;color:#333"><strong>Checked in at:</strong> ${fmtTime(new Date())}</p>
      </div>
      <p style="color:#555">View this event in the <a href="${process.env.FRONTEND_URL}/admin/events" style="color:#2d6a4f">event dashboard</a>.</p>
      <p style="color:#aaa;font-size:12px;margin-top:32px">ReBuilt Meals Platform</p>
    </div>
  `;
  await send({
    to: adminEmails,
    subject: `Checked In: ${ambassador.firstName} ${ambassador.lastName} — ${event.title}`,
    html,
  });
}

async function sendCheckoutNotificationEmail(adminEmails, ambassador, event, hoursWorked, amount) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;background:#f9f9f9;border-radius:8px">
      <h2 style="color:#2d6a4f">🏁 Checked Out: ${event.title}</h2>
      <p style="color:#555"><strong>${ambassador.firstName} ${ambassador.lastName}</strong> just checked out of this event.</p>
      <div style="background:#fff;border-radius:6px;padding:20px;margin:16px 0;border:1px solid #e0e0e0">
        <p style="margin:6px 0;color:#333"><strong>Event:</strong> ${event.title}</p>
        <p style="margin:6px 0;color:#333"><strong>Date:</strong> ${fmt(event.date)}</p>
        <p style="margin:6px 0;color:#333"><strong>Ambassador:</strong> ${ambassador.firstName} ${ambassador.lastName} · ${ambassador.email}</p>
        <p style="margin:6px 0;color:#333"><strong>Hours worked (incl. drive + setup time):</strong> ${hoursWorked.toFixed(2)}</p>
        <p style="margin:6px 0;color:#333"><strong>Pay:</strong> $${amount.toFixed(2)}</p>
      </div>
      <p style="color:#555">Review and approve this shift's pay in the <a href="${process.env.FRONTEND_URL}/admin/payroll" style="color:#2d6a4f">payroll dashboard</a>.</p>
      <p style="color:#aaa;font-size:12px;margin-top:32px">ReBuilt Meals Platform</p>
    </div>
  `;
  await send({
    to: adminEmails,
    subject: `Checked Out: ${ambassador.firstName} ${ambassador.lastName} — ${event.title}`,
    html,
  });
}

async function sendNewOpenEventEmail(ambassadorEmails, event, openShifts) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;background:#f9f9f9;border-radius:8px">
      <h2 style="color:#2d6a4f">📣 New Event Available: ${event.title}</h2>
      <p style="color:#555">A new event has been posted with <strong>${openShifts} open shift${openShifts !== 1 ? 's' : ''}</strong> available for pickup!</p>
      <div style="background:#fff;border-radius:6px;padding:20px;margin:16px 0;border:1px solid #e0e0e0">
        <p style="margin:6px 0;color:#333"><strong>Event:</strong> ${event.title}</p>
        <p style="margin:6px 0;color:#333"><strong>Date:</strong> ${fmt(event.date)}</p>
        ${event.endTime ? `<p style="margin:6px 0;color:#333"><strong>Time:</strong> ${fmtTime(event.date)} – ${fmtTime(event.endTime)}</p>` : `<p style="margin:6px 0;color:#333"><strong>Start:</strong> ${fmtTime(event.date)}</p>`}
        ${arrivalLine(event)}
        <p style="margin:6px 0;color:#333"><strong>Location:</strong> ${event.location}</p>
        ${event.notes ? `<p style="margin:6px 0;color:#555"><strong>Notes:</strong> ${event.notes}</p>` : ''}
      </div>
      <p style="color:#555">Log in to <a href="${process.env.FRONTEND_URL}" style="color:#2d6a4f">your dashboard</a> to claim a shift before it's gone!</p>
      <p style="color:#aaa;font-size:12px;margin-top:32px">ReBuilt Meals Ambassador Platform</p>
    </div>
  `;
  await send({
    to: ambassadorEmails,
    subject: `New Shift Available: ${event.title} on ${fmt(event.date)}`,
    html,
  });
}

async function sendMessageNotificationEmail(recipientEmails, sender, event, messageContent) {
  const preview = messageContent.length > 300 ? messageContent.slice(0, 300) + '…' : messageContent;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:32px;background:#f9f9f9;border-radius:8px">
      <h2 style="color:#2d6a4f">💬 New Message in ${event.title}</h2>
      <p style="color:#555"><strong>${sender.firstName} ${sender.lastName}</strong> sent a message:</p>
      <div style="background:#fff;border-radius:6px;padding:20px;margin:16px 0;border-left:4px solid #2d6a4f;border-top:1px solid #e0e0e0;border-right:1px solid #e0e0e0;border-bottom:1px solid #e0e0e0">
        <p style="margin:0;color:#333;font-size:15px;line-height:1.5">${preview}</p>
      </div>
      <div style="background:#f0f4f0;border-radius:6px;padding:12px 16px;margin:12px 0">
        <p style="margin:0;color:#555;font-size:13px"><strong>Event:</strong> ${event.title} · ${fmt(event.date)}</p>
      </div>
      <p style="color:#555">Log in to <a href="${process.env.FRONTEND_URL}" style="color:#2d6a4f">reply in the Event Messaging section</a>.</p>
      <p style="color:#aaa;font-size:12px;margin-top:32px">ReBuilt Meals Platform</p>
    </div>
  `;
  await send({
    to: recipientEmails,
    subject: `New Message: ${event.title} — from ${sender.firstName} ${sender.lastName}`,
    html,
  });
}

module.exports = {
  sendWelcomeEmail,
  sendShiftAssignedEmail,
  sendEventReminderEmail,
  sendPostEventRecapEmail,
  sendDailySummary,
  sendWeeklyNotification,
  sendShiftPickupEmail,
  sendNewOpenEventEmail,
  sendMessageNotificationEmail,
  sendSalesVerificationEmail,
  sendCheckInNotificationEmail,
  sendCheckoutNotificationEmail,
};
