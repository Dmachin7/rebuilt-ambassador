const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const hash = (pw) => bcrypt.hashSync(pw, 10);

const daysFromNow = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(10, 0, 0, 0);
  return d;
};

const daysAgo = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(10, 0, 0, 0);
  return d;
};

const calcPoints = (entry) => {
  const consistency = entry.promosWorked >= 15 ? 10 + (entry.promosWorked - 15) : 0;
  const noZero = entry.noZeroSalePromos * 5;
  const strong = entry.strongPerformance * 7;
  const weekly = entry.weeklyBenchmarks * 15;
  const penalty = entry.retentionPenalty * 2;
  const quality =
    entry.avgMealsPerSale >= 9 ? 15 :
    entry.avgMealsPerSale >= 8 ? 10 :
    entry.avgMealsPerSale >= 7 ? 7 : 0;
  return consistency + noZero + strong + weekly - penalty + quality;
};

async function main() {
  console.log('🌱 Seeding database...');

  // Clear in correct dependency order
  await prisma.leaderboardEntry.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.report.deleteMany();
  await prisma.message.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  // ─── Users ────────────────────────────────────────────────────────────────
  const admin1 = await prisma.user.create({
    data: {
      email: 'admin@rebuilt.com',
      passwordHash: hash('admin123'),
      role: 'ADMIN',
      firstName: 'Sarah',
      lastName: 'Mitchell',
      phone: '512-555-0101',
      legalName: 'Sarah Anne Mitchell',
      address: '123 Congress Ave, Austin TX 78701',
      isAvailable: true,
      lifetimeSalesCount: 0,
    },
  });

  const admin2 = await prisma.user.create({
    data: {
      email: 'manager@rebuilt.com',
      passwordHash: hash('manager123'),
      role: 'ADMIN',
      firstName: 'James',
      lastName: 'Carter',
      phone: '512-555-0102',
      legalName: 'James R. Carter',
      address: '456 6th St, Austin TX 78702',
      isAvailable: true,
      lifetimeSalesCount: 0,
    },
  });

  // Event Coordinators
  const coord1 = await prisma.user.create({
    data: {
      email: 'coord1@rebuilt.com',
      passwordHash: hash('coord123'),
      role: 'EVENT_COORDINATOR',
      firstName: 'Lauren',
      lastName: 'Hayes',
      phone: '512-555-0301',
      isAvailable: true,
      lifetimeSalesCount: 0,
    },
  });

  const coord2 = await prisma.user.create({
    data: {
      email: 'coord2@rebuilt.com',
      passwordHash: hash('coord123'),
      role: 'EVENT_COORDINATOR',
      firstName: 'Marcus',
      lastName: 'Reid',
      phone: '512-555-0302',
      isAvailable: true,
      lifetimeSalesCount: 0,
    },
  });

  const amb1 = await prisma.user.create({
    data: {
      email: 'jessica@example.com',
      passwordHash: hash('password123'),
      role: 'AMBASSADOR',
      firstName: 'Jessica',
      lastName: 'Rivera',
      phone: '512-555-0201',
      legalName: 'Jessica Marie Rivera',
      address: '789 Elm St, Austin TX 78703',
      ssnPlaceholder: 'XXX-XX-0001',
      isAvailable: true,
      lifetimeSalesCount: 36,
    },
  });

  const amb2 = await prisma.user.create({
    data: {
      email: 'marcus@example.com',
      passwordHash: hash('password123'),
      role: 'AMBASSADOR',
      firstName: 'Marcus',
      lastName: 'Johnson',
      phone: '512-555-0202',
      legalName: 'Marcus T. Johnson',
      address: '321 Pine Rd, Austin TX 78704',
      ssnPlaceholder: 'XXX-XX-0002',
      isAvailable: true,
      lifetimeSalesCount: 68,
    },
  });

  const amb3 = await prisma.user.create({
    data: {
      email: 'priya@example.com',
      passwordHash: hash('password123'),
      role: 'AMBASSADOR',
      firstName: 'Priya',
      lastName: 'Patel',
      phone: '512-555-0203',
      legalName: 'Priya S. Patel',
      address: '654 Cedar Blvd, Austin TX 78705',
      ssnPlaceholder: 'XXX-XX-0003',
      isAvailable: false,
      lifetimeSalesCount: 14,
    },
  });

  const amb4 = await prisma.user.create({
    data: {
      email: 'derek@example.com',
      passwordHash: hash('password123'),
      role: 'AMBASSADOR',
      firstName: 'Derek',
      lastName: 'Thompson',
      phone: '512-555-0204',
      legalName: 'Derek A. Thompson',
      address: '987 Maple Dr, Austin TX 78706',
      ssnPlaceholder: 'XXX-XX-0004',
      isAvailable: true,
      lifetimeSalesCount: 52,
    },
  });

  const amb5 = await prisma.user.create({
    data: {
      email: 'aaliyah@example.com',
      passwordHash: hash('password123'),
      role: 'AMBASSADOR',
      firstName: 'Aaliyah',
      lastName: 'Washington',
      phone: '512-555-0205',
      legalName: 'Aaliyah N. Washington',
      address: '147 Birch Ln, Austin TX 78707',
      ssnPlaceholder: 'XXX-XX-0005',
      isAvailable: true,
      lifetimeSalesCount: 28,
    },
  });

  const amb6 = await prisma.user.create({
    data: {
      email: 'carlos@example.com',
      passwordHash: hash('password123'),
      role: 'AMBASSADOR',
      firstName: 'Carlos',
      lastName: 'Mendez',
      phone: '512-555-0206',
      legalName: 'Carlos R. Mendez',
      address: '258 Walnut St, Austin TX 78708',
      ssnPlaceholder: 'XXX-XX-0006',
      isAvailable: false,
      lifetimeSalesCount: 9,
    },
  });

  const amb7 = await prisma.user.create({
    data: {
      email: 'nina@example.com',
      passwordHash: hash('password123'),
      role: 'AMBASSADOR',
      firstName: 'Nina',
      lastName: 'Chen',
      phone: '512-555-0207',
      legalName: 'Nina X. Chen',
      address: '369 Spruce Ave, Austin TX 78709',
      ssnPlaceholder: 'XXX-XX-0007',
      isAvailable: true,
      lifetimeSalesCount: 81,
    },
  });

  const amb8 = await prisma.user.create({
    data: {
      email: 'tyrone@example.com',
      passwordHash: hash('password123'),
      role: 'AMBASSADOR',
      firstName: 'Tyrone',
      lastName: 'Banks',
      phone: '512-555-0208',
      legalName: 'Tyrone D. Banks',
      address: '741 Oak Creek Dr, Austin TX 78710',
      ssnPlaceholder: 'XXX-XX-0008',
      isAvailable: true,
      lifetimeSalesCount: 43,
    },
  });

  console.log('  ✓ Users created');

  // ─── Events ───────────────────────────────────────────────────────────────
  const event1 = await prisma.event.create({
    data: {
      title: 'Whole Foods Demo – South Lamar',
      location: 'Whole Foods Market, 4001 S Lamar Blvd, Austin, TX 78704',
      milesFromHq: 5.2,
      driveTimeMins: 14,
      contactName: 'Karen Bell',
      contactPhone: '512-555-1001',
      contactEmail: 'karen.bell@wholefoods.com',
      date: daysFromNow(3),
      setupTimeMins: 30,
      breakdownTimeMins: 30,
      ambassadorsNeeded: 2,
      samplesNeeded: 200,
      notes: 'Set up near the prepared foods section. Ask for Karen at customer service.',
      status: 'UPCOMING',
    },
  });

  const event2 = await prisma.event.create({
    data: {
      title: 'Sprouts Farmers Market – The Domain',
      location: 'Sprouts Farmers Market, 11920 Domain Blvd, Austin, TX 78758',
      milesFromHq: 9.8,
      driveTimeMins: 22,
      contactName: 'Tom Nguyen',
      contactPhone: '512-555-1002',
      contactEmail: 'tom.nguyen@sprouts.com',
      date: daysFromNow(5),
      setupTimeMins: 45,
      breakdownTimeMins: 30,
      ambassadorsNeeded: 3,
      samplesNeeded: 300,
      notes: 'High-traffic weekend. Bring extra signage. Tom will meet you at the entrance.',
      status: 'UPCOMING',
    },
  });

  const event3 = await prisma.event.create({
    data: {
      title: 'Barton Creek Farmers Market',
      location: 'Barton Creek Greenbelt, 2901 S Capital of Texas Hwy, Austin, TX 78746',
      milesFromHq: 7.1,
      driveTimeMins: 18,
      contactName: 'Lisa Park',
      contactPhone: '512-555-1003',
      contactEmail: 'info@bartoncreekfarmersmarket.com',
      date: daysFromNow(10),
      setupTimeMins: 60,
      breakdownTimeMins: 45,
      ambassadorsNeeded: 4,
      samplesNeeded: 400,
      notes: 'Outdoor event — check weather forecast. Bring a canopy if rain is expected.',
      status: 'UPCOMING',
    },
  });

  const event4 = await prisma.event.create({
    data: {
      title: 'H-E-B Demo – Round Rock',
      location: 'H-E-B, 2051 N Mays St, Round Rock, TX 78664',
      milesFromHq: 23.4,
      driveTimeMins: 35,
      contactName: 'Mark Stevens',
      contactPhone: '512-555-1004',
      contactEmail: 'mark.stevens@heb.com',
      date: daysFromNow(7),
      setupTimeMins: 30,
      breakdownTimeMins: 30,
      ambassadorsNeeded: 2,
      samplesNeeded: 150,
      notes: 'Demo table provided by HEB. Bring tablecloth and branded materials.',
      status: 'UPCOMING',
    },
  });

  const event5 = await prisma.event.create({
    data: {
      title: 'Central Market Demo – North Lamar',
      location: 'Central Market, 4001 N Lamar Blvd, Austin, TX 78756',
      milesFromHq: 3.8,
      driveTimeMins: 10,
      contactName: 'Rachel Kim',
      contactPhone: '512-555-1005',
      contactEmail: 'rachel.kim@centralmarket.com',
      date: daysFromNow(14),
      setupTimeMins: 30,
      breakdownTimeMins: 30,
      ambassadorsNeeded: 2,
      samplesNeeded: 180,
      notes: 'Premium clientele. Emphasize quality ingredients and sourcing story.',
      status: 'UPCOMING',
    },
  });

  const event6 = await prisma.event.create({
    data: {
      title: 'Mueller Farmers Market',
      location: 'Mueller Lake Park, 4550 Mueller Blvd, Austin, TX 78723',
      milesFromHq: 4.2,
      driveTimeMins: 11,
      contactName: 'Janet Wu',
      contactPhone: '512-555-1009',
      contactEmail: 'info@muellerfarmersmarket.com',
      date: daysFromNow(1),
      setupTimeMins: 60,
      breakdownTimeMins: 45,
      ambassadorsNeeded: 3,
      samplesNeeded: 350,
      notes: 'Very popular market. Bring coolers for samples. Setup starts at 8am.',
      status: 'UPCOMING',
    },
  });

  const event7 = await prisma.event.create({
    data: {
      title: 'Costco Roadshow – Cedar Park',
      location: 'Costco Wholesale, 1890 E Whitestone Blvd, Cedar Park, TX 78613',
      milesFromHq: 28.1,
      driveTimeMins: 42,
      contactName: 'Steve Morrison',
      contactPhone: '512-555-1010',
      contactEmail: 'steve.morrison@costco.com',
      date: daysFromNow(21),
      setupTimeMins: 90,
      breakdownTimeMins: 60,
      ambassadorsNeeded: 4,
      samplesNeeded: 500,
      notes: 'Multi-day event (Fri–Sun). Coordinate with Steve for table setup. High volume.',
      status: 'UPCOMING',
    },
  });

  // Completed events (past)
  const event8 = await prisma.event.create({
    data: {
      title: 'Whole Foods Demo – Downtown',
      location: 'Whole Foods Market, 525 N Lamar Blvd, Austin, TX 78703',
      milesFromHq: 1.5,
      driveTimeMins: 6,
      contactName: 'David Lee',
      contactPhone: '512-555-1006',
      contactEmail: 'david.lee@wholefoods.com',
      date: daysAgo(5),
      setupTimeMins: 30,
      breakdownTimeMins: 30,
      ambassadorsNeeded: 2,
      samplesNeeded: 200,
      notes: 'Great location. High foot traffic all day.',
      status: 'COMPLETED',
      totalMealsSold: 178,
      totalSalesInput: 21,
    },
  });

  const event9 = await prisma.event.create({
    data: {
      title: 'Sprouts Demo – South Congress',
      location: 'Sprouts Farmers Market, 1807 S Congress Ave, Austin, TX 78704',
      milesFromHq: 4.5,
      driveTimeMins: 12,
      contactName: 'Amy Torres',
      contactPhone: '512-555-1007',
      contactEmail: 'amy.torres@sprouts.com',
      date: daysAgo(12),
      setupTimeMins: 30,
      breakdownTimeMins: 30,
      ambassadorsNeeded: 2,
      samplesNeeded: 200,
      notes: 'Great South Austin location. Weekend afternoon crowd is ideal.',
      status: 'COMPLETED',
      totalMealsSold: 226,
      totalSalesInput: 25,
    },
  });

  const event10 = await prisma.event.create({
    data: {
      title: 'Natural Grocers Demo – Westlake',
      location: 'Natural Grocers, 3540 Bee Cave Rd, Austin, TX 78746',
      milesFromHq: 8.9,
      driveTimeMins: 21,
      contactName: 'Brian Collins',
      contactPhone: '512-555-1008',
      contactEmail: 'brian@naturalgrocers.com',
      date: daysAgo(19),
      setupTimeMins: 30,
      breakdownTimeMins: 30,
      ambassadorsNeeded: 1,
      samplesNeeded: 100,
      notes: 'Smaller store — be mindful of space. Organic-focused clientele.',
      status: 'COMPLETED',
      totalMealsSold: 47,
      totalSalesInput: 5,
    },
  });

  console.log('  ✓ Events created');

  // ─── Shifts ───────────────────────────────────────────────────────────────
  await prisma.shift.create({ data: { eventId: event1.id, status: 'OPEN' } });
  await prisma.shift.create({ data: { eventId: event1.id, ambassadorId: amb1.id, status: 'ASSIGNED' } });

  await prisma.shift.create({ data: { eventId: event2.id, status: 'OPEN' } });
  await prisma.shift.create({ data: { eventId: event2.id, status: 'OPEN' } });
  await prisma.shift.create({ data: { eventId: event2.id, ambassadorId: amb2.id, status: 'ASSIGNED' } });

  await prisma.shift.create({ data: { eventId: event3.id, status: 'OPEN' } });
  await prisma.shift.create({ data: { eventId: event3.id, status: 'OPEN' } });
  await prisma.shift.create({ data: { eventId: event3.id, ambassadorId: amb3.id, status: 'ASSIGNED' } });
  await prisma.shift.create({ data: { eventId: event3.id, ambassadorId: amb4.id, status: 'ASSIGNED' } });

  await prisma.shift.create({ data: { eventId: event4.id, status: 'OPEN' } });
  await prisma.shift.create({ data: { eventId: event4.id, ambassadorId: amb5.id, status: 'ASSIGNED' } });

  await prisma.shift.create({ data: { eventId: event5.id, status: 'OPEN' } });
  await prisma.shift.create({ data: { eventId: event5.id, ambassadorId: amb6.id, status: 'ASSIGNED' } });

  await prisma.shift.create({ data: { eventId: event6.id, status: 'OPEN' } });
  await prisma.shift.create({ data: { eventId: event6.id, ambassadorId: amb7.id, status: 'ASSIGNED' } });
  await prisma.shift.create({ data: { eventId: event6.id, ambassadorId: amb8.id, status: 'ASSIGNED' } });

  await prisma.shift.create({ data: { eventId: event7.id, status: 'OPEN' } });
  await prisma.shift.create({ data: { eventId: event7.id, status: 'OPEN' } });
  await prisma.shift.create({ data: { eventId: event7.id, ambassadorId: amb1.id, status: 'ASSIGNED' } });
  await prisma.shift.create({ data: { eventId: event7.id, ambassadorId: amb2.id, status: 'ASSIGNED' } });

  // Completed shifts
  const ci1 = new Date(event8.date.getTime() + 30 * 60000);
  const co1 = new Date(event8.date.getTime() + 4.5 * 3600000);
  const shift_e8_1 = await prisma.shift.create({
    data: {
      eventId: event8.id,
      ambassadorId: amb1.id,
      status: 'COMPLETED',
      checkinTime: ci1,
      checkoutTime: co1,
      checkinPhotoUrl: '/mock-photos/setup-booth.jpg',
    },
  });

  const ci2 = new Date(event8.date.getTime() + 35 * 60000);
  const co2 = new Date(event8.date.getTime() + 4.25 * 3600000);
  const shift_e8_2 = await prisma.shift.create({
    data: {
      eventId: event8.id,
      ambassadorId: amb3.id,
      status: 'COMPLETED',
      checkinTime: ci2,
      checkoutTime: co2,
      checkinPhotoUrl: '/mock-photos/setup-booth.jpg',
    },
  });

  const ci3 = new Date(event9.date.getTime() + 25 * 60000);
  const co3 = new Date(event9.date.getTime() + 5 * 3600000);
  const shift_e9_1 = await prisma.shift.create({
    data: {
      eventId: event9.id,
      ambassadorId: amb2.id,
      status: 'COMPLETED',
      checkinTime: ci3,
      checkoutTime: co3,
      checkinPhotoUrl: '/mock-photos/setup-booth.jpg',
    },
  });

  const ci4 = new Date(event9.date.getTime() + 40 * 60000);
  const co4 = new Date(event9.date.getTime() + 4.75 * 3600000);
  const shift_e9_2 = await prisma.shift.create({
    data: {
      eventId: event9.id,
      ambassadorId: amb4.id,
      status: 'COMPLETED',
      checkinTime: ci4,
      checkoutTime: co4,
      checkinPhotoUrl: '/mock-photos/setup-booth.jpg',
    },
  });

  const ci5 = new Date(event10.date.getTime() + 20 * 60000);
  const co5 = new Date(event10.date.getTime() + 3.5 * 3600000);
  const shift_e10_1 = await prisma.shift.create({
    data: {
      eventId: event10.id,
      ambassadorId: amb5.id,
      status: 'COMPLETED',
      checkinTime: ci5,
      checkoutTime: co5,
      checkinPhotoUrl: '/mock-photos/setup-booth.jpg',
    },
  });

  console.log('  ✓ Shifts created');

  // ─── Reports ──────────────────────────────────────────────────────────────
  await prisma.report.create({
    data: {
      shiftId: shift_e8_1.id,
      feedback:
        "Great event! Customers were really receptive. Several people said they'd been looking for a healthy meal prep service in Austin. The location near prepared foods was perfect.",
      issues: 'The demo table was a bit small. Could use a larger setup next time.',
      mealsSold: 98,
      totalSales: 12,
      mealsPerSale: 8.2,
    },
  });

  await prisma.report.create({
    data: {
      shiftId: shift_e8_2.id,
      feedback:
        'Solid turnout. The lunch rush brought in a lot of foot traffic. People were curious and the chicken piccata sample was a big hit.',
      issues: null,
      mealsSold: 80,
      totalSales: 9,
      mealsPerSale: 8.9,
    },
  });

  await prisma.report.create({
    data: {
      shiftId: shift_e9_1.id,
      feedback:
        'Busiest Saturday I have seen yet. Made tons of connections. Everyone loved the new packaging. Had multiple people come back for a second sample.',
      issues: 'Ran out of samples about 30 minutes before the event ended — bring 20% more next time.',
      mealsSold: 137,
      totalSales: 15,
      mealsPerSale: 9.1,
    },
  });

  await prisma.report.create({
    data: {
      shiftId: shift_e9_2.id,
      feedback:
        'Good afternoon traffic. Customers asked a lot of questions about ingredients and macros. Having a printed FAQ sheet would help.',
      issues: null,
      mealsSold: 89,
      totalSales: 10,
      mealsPerSale: 8.9,
    },
  });

  await prisma.report.create({
    data: {
      shiftId: shift_e10_1.id,
      feedback:
        "Quieter store but quality customers. Several signed up for the subscription plan on the spot. Great store for premium meal prep shoppers.",
      issues: 'Store was very cold — bring a layer for next time.',
      mealsSold: 47,
      totalSales: 5,
      mealsPerSale: 9.4,
    },
  });

  console.log('  ✓ Reports created');

  // ─── Payments ─────────────────────────────────────────────────────────────
  const calcPay = (ci, co) => {
    const hrs = (co - ci) / 3600000;
    return {
      hoursWorked: Math.round(hrs * 100) / 100,
      amount: Math.round(hrs * 20 * 100) / 100,
    };
  };

  await prisma.payment.create({
    data: { shiftId: shift_e8_1.id, ambassadorId: amb1.id, ...calcPay(ci1, co1), status: 'PAID' },
  });
  await prisma.payment.create({
    data: { shiftId: shift_e8_2.id, ambassadorId: amb3.id, ...calcPay(ci2, co2), status: 'APPROVED' },
  });
  await prisma.payment.create({
    data: { shiftId: shift_e9_1.id, ambassadorId: amb2.id, ...calcPay(ci3, co3), status: 'APPROVED' },
  });
  await prisma.payment.create({
    data: { shiftId: shift_e9_2.id, ambassadorId: amb4.id, ...calcPay(ci4, co4), status: 'PENDING' },
  });
  await prisma.payment.create({
    data: { shiftId: shift_e10_1.id, ambassadorId: amb5.id, ...calcPay(ci5, co5), status: 'PENDING' },
  });

  console.log('  ✓ Payments created');

  // ─── Messages ─────────────────────────────────────────────────────────────
  const msg = (eventId, senderId, content, minsAgo) =>
    prisma.message.create({
      data: {
        eventId,
        senderId,
        content,
        createdAt: new Date(Date.now() - minsAgo * 60000),
      },
    });

  await msg(event8.id, admin1.id, 'Hey team! Ready for Whole Foods Downtown today? Set up starts at 9:30am.', 5 * 24 * 60 + 90);
  await msg(event8.id, amb1.id, 'On my way! Should be there by 9:15.', 5 * 24 * 60 + 75);
  await msg(event8.id, amb3.id, 'Same here — parking on Lamar is tricky on Saturdays. Leaving early.', 5 * 24 * 60 + 60);
  await msg(event8.id, admin1.id, 'Perfect. Samples are already in the fridge at the store. Ask for David.', 5 * 24 * 60 + 50);
  await msg(event8.id, amb1.id, 'Great event! Total Meals Sold well above target. Lots of positive feedback.', 5 * 24 * 60 - 60);

  await msg(event9.id, admin2.id, 'South Congress crew — big day ahead! Weather looks perfect.', 12 * 24 * 60 + 100);
  await msg(event9.id, amb2.id, 'Pumped! This location always has great foot traffic.', 12 * 24 * 60 + 85);
  await msg(event9.id, amb4.id, 'Running 5 mins late — traffic on I-35. Sorry!', 12 * 24 * 60 + 60);
  await msg(event9.id, admin2.id, 'No worries Derek, Marcus can get started. FYI we need 300 samples today.', 12 * 24 * 60 + 50);

  await msg(event1.id, admin1.id, 'Whole Foods South Lamar is coming up on Thursday! Jessica + one more spot open.', 60);
  await msg(event1.id, amb1.id, 'Confirmed, I will be there. What time should I arrive?', 45);
  await msg(event1.id, admin1.id, 'Setup at 10am, demo runs 11am–3pm. Breakdown by 3:30pm.', 30);

  console.log('  ✓ Messages created');

  // ─── Leaderboard ──────────────────────────────────────────────────────────
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const leaderboardData = [
    { userId: amb1.id, promosWorked: 19, noZeroSalePromos: 17, strongPerformance: 12, weeklyBenchmarks: 3, retentionPenalty: 1, avgMealsPerSale: 8.4 },
    { userId: amb2.id, promosWorked: 22, noZeroSalePromos: 20, strongPerformance: 15, weeklyBenchmarks: 4, retentionPenalty: 2, avgMealsPerSale: 9.1 },
    { userId: amb3.id, promosWorked: 16, noZeroSalePromos: 14, strongPerformance: 9,  weeklyBenchmarks: 2, retentionPenalty: 0, avgMealsPerSale: 7.9 },
    { userId: amb4.id, promosWorked: 15, noZeroSalePromos: 13, strongPerformance: 8,  weeklyBenchmarks: 2, retentionPenalty: 1, avgMealsPerSale: 8.1 },
    { userId: amb5.id, promosWorked: 18, noZeroSalePromos: 16, strongPerformance: 11, weeklyBenchmarks: 3, retentionPenalty: 0, avgMealsPerSale: 9.3 },
    { userId: amb6.id, promosWorked: 12, noZeroSalePromos: 10, strongPerformance: 6,  weeklyBenchmarks: 1, retentionPenalty: 2, avgMealsPerSale: 7.2 },
    { userId: amb7.id, promosWorked: 20, noZeroSalePromos: 18, strongPerformance: 13, weeklyBenchmarks: 3, retentionPenalty: 1, avgMealsPerSale: 8.7 },
    { userId: amb8.id, promosWorked: 14, noZeroSalePromos: 11, strongPerformance: 7,  weeklyBenchmarks: 1, retentionPenalty: 3, avgMealsPerSale: 7.5 },
  ];

  for (const entry of leaderboardData) {
    await prisma.leaderboardEntry.create({
      data: { ...entry, month, year, totalPoints: calcPoints(entry) },
    });
  }

  console.log('  ✓ Leaderboard entries created');
  console.log('');
  console.log('✅ Seed complete!');
  console.log('');
  console.log('  Admin accounts:');
  console.log('    admin@rebuilt.com      / admin123');
  console.log('    manager@rebuilt.com    / manager123');
  console.log('');
  console.log('  Event Coordinator accounts (password: coord123):');
  console.log('    coord1@rebuilt.com     (Lauren Hayes)');
  console.log('    coord2@rebuilt.com     (Marcus Reid)');
  console.log('');
  console.log('  Brand Ambassador accounts (all use password: password123):');
  console.log('    jessica@example.com    marcus@example.com');
  console.log('    priya@example.com      derek@example.com');
  console.log('    aaliyah@example.com    carlos@example.com');
  console.log('    nina@example.com       tyrone@example.com');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
