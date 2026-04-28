# ReBuilt Ambassador & Event Management Platform

<!-- platform v1 -->

Internal platform for managing ambassador event staffing, shift scheduling, check-in/out, payroll, reporting, and the "Cook Less, Sell More" monthly leaderboard.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite, Tailwind CSS, FullCalendar |
| Backend | Node.js + Express |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT (7-day tokens, role-based access) |

---

## Prerequisites

Install **PostgreSQL** before running the project.

**macOS — easiest options:**

```bash
# Option A: Homebrew
brew install postgresql@15
brew services start postgresql@15
echo 'export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Option B: Postgres.app (GUI)
# Download from https://postgresapp.com/
```

**Create the database:**
```bash
createdb rebuilt_platform
```

---

## Running Locally

### 1. Clone / open the project
```
Arthur Project/
├── client/   ← React frontend (port 5173)
└── server/   ← Express API (port 3001)
```

### 2. Configure environment variables

The `server/.env` file is already created. Edit it if your Postgres connection differs:
```env
DATABASE_URL="postgresql://localhost:5432/rebuilt_platform"
JWT_SECRET="rebuilt-dev-secret-change-in-production-please"
PORT=3001
```

### 3. Set up the database

```bash
cd server
npm run db:migrate    # Creates tables
npm run db:seed       # Populates with mock data
npm run db:studio     # (Optional) Open Prisma Studio GUI at localhost:5555
```

### 4. Start the servers (two terminal tabs)

**Terminal 1 — API server:**
```bash
cd server
npm run dev
# → Server running on http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
# → App running on http://localhost:5173
```

### 5. Log in

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rebuilt.com | admin123 |
| Admin | manager@rebuilt.com | manager123 |
| Event Coordinator | coord1@rebuilt.com | coord123 |
| Event Coordinator | coord2@rebuilt.com | coord123 |
| Brand Ambassador | jessica@example.com | password123 |
| Brand Ambassador | marcus@example.com | password123 |
| Brand Ambassador | priya@example.com | password123 |
| Brand Ambassador | derek@example.com | password123 |
| Brand Ambassador | aaliyah@example.com | password123 |
| Brand Ambassador | carlos@example.com | password123 |
| Brand Ambassador | nina@example.com | password123 |
| Brand Ambassador | tyrone@example.com | password123 |

---

## User Roles

Three roles with distinct permissions:

### Admin
Full access to all features including payroll, post-event reports, and the ability to send broadcast alerts.

### Event Coordinator
- ✅ Create and edit events
- ✅ Assign ambassadors to shifts
- ✅ View ambassador availability
- ✅ Add new Brand Ambassador accounts
- ✅ View calendar, messages, leaderboard, and dashboard
- ❌ No access to payroll
- ❌ No access to post-event reports

### Brand Ambassador
Mobile-first experience for checking in/out, submitting post-event reports, viewing earnings, and the leaderboard.

---

## Ambassador Availability

Ambassadors can toggle their own status (Available / Unavailable) from their dashboard. Admins and Event Coordinators see this status when assigning shifts.

---

## Commission Structure

Commission is tiered based on **lifetime sales count** (total transactions, not meals):

| Lifetime Sales | Rate Per Sale |
|---------------|--------------|
| 1 – 50 | $10 / sale |
| 51+ | $20 / sale |

- Sales are tracked cumulatively per ambassador across all events
- The tier crossing is calculated per pay period — sales before and after 50 are prorated correctly
- Commission is displayed on the Ambassador dashboard and included in Payroll → Bi-Weekly Summary

---

## Payroll — Bi-Weekly Summary

Admin-only tab under Payroll that shows per ambassador for any 14-day window:

| Column | Calculation |
|--------|------------|
| Hours Worked | Sum of shift hours in period |
| Hourly Pay | Hours × $20 |
| Miles Driven | Sum of `event.milesFromHq × 2` (round-trip) for all shifts |
| Mileage Reimbursement | Miles × $0.30 |
| Commission Earned | Tiered $10/$20 per sale (see above) |
| Total Payout | Hourly + Mileage + Commission |

CSV export includes all columns.

---

## Metrics — Post-Event Reports

| Field | Description |
|-------|-------------|
| Total Meals Sold | Number of individual meal units sold |
| Total Sales | Number of transactions |
| Avg Meals/Sale | Auto-calculated: Meals Sold ÷ Total Sales |

Reports are submitted by Brand Ambassadors after each shift. Admins can view the aggregate across all events. Event-level totals (entered by admin) are stored on the Event record.

---

## Environment Variables

All keys go in `server/.env`. None are required to run the app in mock mode — stubs work out of the box.

```env
# ── Required ───────────────────────────────────────────────
DATABASE_URL=              # PostgreSQL connection string
JWT_SECRET=                # Any strong random string

# ── Google Maps (Module 1 & 2) ──────────────────────────────
GOOGLE_MAPS_API_KEY=       # Enable: Maps JavaScript API, Places API, Distance Matrix API
                           # https://console.cloud.google.com/apis

# ── Twilio SMS (Modules 2, 7) ───────────────────────────────
TWILIO_ACCOUNT_SID=        # https://console.twilio.com/
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=       # Must be SMS-capable (e.g. +15125550001)

# ── SendGrid / Nodemailer (Notifications) ───────────────────
SENDGRID_API_KEY=          # https://app.sendgrid.com/settings/api_keys
FROM_EMAIL=                # Verified sender address (e.g. noreply@rebuilt.com)

# ── ReBuilt HQ (Module 1) ───────────────────────────────────
REBUILT_HQ_ADDRESS=        # Full address used as origin for distance calculations
                           # e.g. "2000 E 6th St, Austin, TX 78702"

# ── Cloud Storage (Module 3) ────────────────────────────────
CLOUDINARY_URL=            # https://cloudinary.com/  — OR use S3 (see README note below)
```

---

## Swapping in Real Integrations

Every stub is a clearly labeled function. Find them in `server/src/stubs/` and `client/src/stubs/`.

### `server/src/stubs/email.js` — Daily & Weekly Notifications

Stub functions: `sendDailySummary(adminEmails, summary)` and `sendWeeklyNotification(adminEmails, summary)`

Both currently `console.log` the summary data. To wire in real email:

**SendGrid:**
```js
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
await sgMail.send({ to: adminEmails, from: process.env.FROM_EMAIL, subject, text });
```

**Nodemailer:**
```js
const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
await transporter.sendMail({ from, to, subject, text });
```

Endpoints that trigger these stubs:
- `POST /api/notifications/daily` — end-of-day summary
- `POST /api/notifications/weekly` — weekly summary

To automate delivery, add a cron job (e.g. `node-cron`) that calls these endpoints on a schedule.

### `server/src/stubs/maps.js`

| Function | Replace With |
|----------|-------------|
| `calculateDistanceFromHQ(location)` | Google Maps Distance Matrix API |
| `autocompleteLocation(query)` | Google Maps Places Autocomplete |

### `server/src/stubs/sms.js`

| Function | Replace With |
|----------|-------------|
| `sendSMSReminder(phone, message, hoursUntilShift)` | Twilio `client.messages.create(...)` |
| `sendUrgentAlert(phones, message)` | Twilio Notify for broadcast |

**Scheduling reminders:** Use `node-cron` or BullMQ to trigger `sendSMSReminder` at `shiftDate - 24h` and `shiftDate - 2h`.

### `server/src/stubs/storage.js`

| Function | Replace With |
|----------|-------------|
| `uploadPhoto(file)` | Cloudinary `cloudinary.uploader.upload(file.path)` or AWS S3 |

### `server/src/stubs/notifications.js`

| Function | Replace With |
|----------|-------------|
| `sendPushNotification(userIds, title, body)` | Firebase Cloud Messaging (FCM) |

### `client/src/stubs/gps.js`

| Function | Replace With |
|----------|-------------|
| `getCurrentLocation()` | `navigator.geolocation.getCurrentPosition()` — send `{ lat, lng }` to server for 300ft geofence check |

---

## Gamification — Cook Less, Sell More

Monthly points competition. Resets on the 1st of each month.

### Scoring Formula

```
totalPoints =
  (promosWorked >= 15 ? 10 + (promosWorked - 15) : 0)   // Consistency base
  + (noZeroSalePromos × 5)                                // No zero-sale promos
  + (strongPerformance × 7)                               // Promos with 3+ sales
  + (weeklyBenchmarks × 15)                               // Weeks with 10+ total sales
  - (retentionPenalty × 2)                                // Client cancels after 1st order
  + avgMealsPerSale bonus:
      9.00+ avg  → +15 pts
      8.00–8.99  → +10 pts
      7.00–7.99  → +7 pts
      < 7.00     → +0 pts
```

### Qualification
- Minimum **15 promos worked** to appear in the scored rankings

---

## Future Features (Placeholders to Scaffold)

| Feature | Notes |
|---------|-------|
| **Equipment Tracking** | Tables, banners, coolers. New `Equipment` and `EquipmentCheckout` Prisma models. |
| **Weather Alerts** | OpenWeatherMap API for outdoor events. Trigger alert if rain > 50% probability. |
| **AI Smart Scheduling** | Suggest best ambassador for a shift based on past performance + proximity. |
| **Cost per Demo** | total_event_cost / events_count. Add event cost field. |
| **Sales Lift by Event** | Requires retailer sales data integration. |
| **Revenue per Ambassador** | Sum of (totalSales × avg_order_value) per ambassador. Add avg_order_value to Report model. |
| **Conversion Rate** | (totalSales / samplesNeeded) × 100. Already stored — add computed field. |
| **Geo Performance Heat Map** | Plot event performance on a map using Google Maps JS SDK. |
| **1099 Reporting** | Legal name, address, SSN placeholder already stored. Add annual export with IRS thresholds ($600+). |
| **Push Notifications (Web)** | Add FCM token to User model. See `server/src/stubs/notifications.js`. |
| **Automated Notification Scheduling** | Use `node-cron` to auto-trigger daily/weekly email summaries without manual POST calls. |

---

## Project Structure

```
Arthur Project/
├── client/
│   ├── src/
│   │   ├── api/              # API functions (index.js + client.js)
│   │   ├── components/
│   │   │   ├── ui/           # Button, Card, Input, Badge, Modal, etc.
│   │   │   └── layout/       # AdminLayout (role-aware nav), AmbassadorLayout
│   │   ├── context/          # AuthContext (JWT + role helpers)
│   │   ├── pages/
│   │   │   ├── auth/         # Login
│   │   │   ├── admin/        # Dashboard, Events, Calendar, Ambassadors,
│   │   │   │                 # Reports (Admin only), Payroll (Admin only),
│   │   │   │                 # Messages, Leaderboard
│   │   │   └── ambassador/   # Dashboard, Shifts, CheckIn, Report,
│   │   │                     # Earnings, Leaderboard
│   │   ├── stubs/            # gps.js, maps.js (client-side stubs)
│   │   └── utils/            # formatters.js
│   ├── tailwind.config.js    # Brand color: mint #A8E6CF
│   └── vite.config.js        # Proxy: /api → localhost:3001
│
├── server/
│   ├── prisma/
│   │   ├── schema.prisma     # Full DB schema (7 models, 3 roles)
│   │   └── seed.js           # Mock data (12 users across 3 roles, 10 events, ...)
│   ├── src/
│   │   ├── lib/prisma.js     # Shared Prisma client
│   │   ├── middleware/       # auth.js (JWT), rbac.js (requireRole)
│   │   ├── routes/           # auth, events, shifts, reports, payments,
│   │   │                     # messages, leaderboard, dashboard, users,
│   │   │                     # notifications
│   │   └── stubs/            # maps.js, sms.js, storage.js, notifications.js,
│   │                         # email.js (daily/weekly summaries)
│   └── .env                  # All environment variables
│
└── README.md
```

---

## Database Reset

To wipe and reseed:
```bash
cd server
npx prisma db push --force-reset
node prisma/seed.js
```

Or just reseed without dropping:
```bash
node prisma/seed.js
```
